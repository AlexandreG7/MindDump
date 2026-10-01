package fr.minddump.app;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Remplir le panier drive Match depuis une liste (docs/app-mobile.md, étape
 * 3.6), version Android de MatchDrivePlugin.swift.
 *
 * Les API de Match ne répondent qu'à une page de leur site : l'écran ouvre
 * supermarchesmatch.fr dans une seconde WebView et y injecte les scripts de
 * l'extension (drive-extension/, copiés dans public/drive/). Leurs appels à
 * MindDump remontent ici puis à la page MindDump de l'app (événement « api »,
 * src/lib/matchDrive.ts), qui a la session ; la réponse redescend par reply().
 * L'écran est une fenêtre de l'activité principale : la page MindDump continue
 * de tourner derrière pour relayer ces appels.
 */
@CapacitorPlugin(name = "MatchDrive")
public class MatchDrivePlugin extends Plugin {

    private static final String HOME = "https://www.supermarchesmatch.fr/fr";

    /** Liste en attente : le script la prend (takeFill) une fois le site prêt. */
    private String pendingListId;
    /** Dernière liste lancée, pour le bouton « Remplir le panier ». */
    private String lastListId;
    private Dialog dialog;
    private WebView webView;
    private String script;

    @PluginMethod
    public void open(PluginCall call) {
        String listId = call.getString("listId");
        if (listId == null || listId.isEmpty()) {
            call.reject("listId requis");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                if (script == null) script = injectedScript();
            } catch (IOException e) {
                call.reject("Scripts Match absents de l'app");
                return;
            }
            lastListId = listId;
            if (dialog != null && dialog.isShowing()) {
                fill(listId);
            } else {
                pendingListId = listId;
                show();
            }
            call.resolve();
        });
    }

    /** Réponse de la page MindDump à un appel « api ». */
    @PluginMethod
    public void reply(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("id requis");
            return;
        }
        JSObject result = call.getObject("result", new JSObject().put("ok", false).put("error", "Réponse vide"));
        getActivity().runOnUiThread(() -> {
            reply(id, result.toString());
            call.resolve();
        });
    }

    @SuppressLint({ "SetJavaScriptEnabled", "AddJavascriptInterface" })
    private void show() {
        dialog = new Dialog(getActivity(), android.R.style.Theme_DeviceDefault_DayNight);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout layout = new LinearLayout(getActivity());
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(ContextCompat.getColor(getActivity(), R.color.app_background));

        LinearLayout bar = new LinearLayout(getActivity());
        bar.setGravity(Gravity.CENTER_VERTICAL);
        int padding = dp(8);
        bar.setPadding(padding, 0, padding, 0);
        Button close = textButton("Fermer");
        close.setOnClickListener((v) -> dialog.dismiss());
        TextView title = new TextView(getActivity());
        title.setText("Panier Match");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        title.setGravity(Gravity.CENTER);
        Button fillButton = textButton("Remplir le panier");
        fillButton.setOnClickListener((v) -> {
            if (lastListId != null) fill(lastListId);
        });
        bar.addView(close);
        bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        bar.addView(fillButton);
        layout.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)));

        webView = new WebView(getActivity());
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        webView.addJavascriptInterface(new Bridge(), "MindDumpDrive");
        webView.setWebViewClient(new WebViewClient() {
            // Le site Match reste ici ; tout autre lien part dans le navigateur.
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (isMatch(url) || "about".equals(url.getScheme()) || "blob".equals(url.getScheme())) return false;
                try {
                    getActivity().startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (RuntimeException ignored) {}
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (isMatch(Uri.parse(url))) view.evaluateJavascript(script, null);
            }
        });
        layout.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        // Fenêtre bord à bord : la barre et la page s'écartent des barres système.
        ViewCompat.setOnApplyWindowInsetsListener(layout, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        dialog.setContentView(layout);
        Window window = dialog.getWindow();
        if (window != null) {
            window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            window.setStatusBarColor(Color.TRANSPARENT);
            // Icônes des barres système lisibles sur le fond clair ou sombre.
            boolean night = (getActivity().getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
            WindowInsetsControllerCompat bars = new WindowInsetsControllerCompat(window, window.getDecorView());
            bars.setAppearanceLightStatusBars(!night);
            bars.setAppearanceLightNavigationBars(!night);
        }
        dialog.setOnKeyListener((d, keyCode, event) -> {
            // Retour : page précédente du site Match, sinon fermeture.
            if (keyCode == android.view.KeyEvent.KEYCODE_BACK && event.getAction() == android.view.KeyEvent.ACTION_UP
                && webView.canGoBack()) {
                webView.goBack();
                return true;
            }
            return false;
        });
        dialog.setOnDismissListener((d) -> {
            webView.removeJavascriptInterface("MindDumpDrive");
            webView.destroy();
            webView = null;
            dialog = null;
            notifyListeners("closed", new JSObject());
        });
        dialog.show();
        webView.loadUrl(HOME);
    }

    /** Appels du script injecté (bridge.js), acceptés seulement sur une page de Match. */
    private class Bridge {

        @JavascriptInterface
        public void postMessage(String body) {
            getActivity().runOnUiThread(() -> {
                if (webView == null || !isMatch(Uri.parse(String.valueOf(webView.getUrl())))) return;
                handle(body);
            });
        }
    }

    private void handle(String body) {
        try {
            JSONObject envelope = new JSONObject(body);
            int id = envelope.getInt("id");
            JSONObject message = envelope.getJSONObject("message");
            String type = message.optString("type");
            if ("takeFill".equals(type)) {
                JSONObject result = new JSONObject().put("listId", pendingListId == null ? JSONObject.NULL : pendingListId);
                pendingListId = null;
                reply(id, result.toString());
            } else if ("api".equals(type)) {
                JSObject data = new JSObject();
                data.put("id", id);
                data.put("method", message.optString("method"));
                data.put("path", message.optString("path"));
                if (message.has("body")) data.put("body", message.get("body"));
                // Gardé si la page MindDump se recharge à ce moment.
                notifyListeners("api", data, true);
            } else {
                reply(id, "{\"ok\":false,\"error\":\"Message inconnu\"}");
            }
        } catch (JSONException ignored) {}
    }

    private void fill(String listId) {
        evaluate("window.__minddumpNative && window.__minddumpNative.fill(" + JSONObject.quote(listId) + ")");
    }

    private void reply(int id, String resultJson) {
        evaluate("window.__minddumpNative && window.__minddumpNative.reply(" + id + ", " + resultJson + ")");
    }

    private void evaluate(String source) {
        if (webView != null) webView.evaluateJavascript(source, null);
    }

    private static boolean isMatch(Uri url) {
        String host = url.getHost();
        if (host == null) return false;
        host = host.toLowerCase();
        return host.equals("supermarchesmatch.fr") || host.endsWith(".supermarchesmatch.fr");
    }

    private Button textButton(String label) {
        Button button = new Button(getActivity(), null, android.R.attr.borderlessButtonStyle);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(Color.rgb(0xE6, 0x80, 0x37));
        return button;
    }

    private int dp(int value) {
        return Math.round(value * getActivity().getResources().getDisplayMetrics().density);
    }

    /** page.js, le pont, puis content.js dans la portée du pont. */
    private String injectedScript() throws IOException {
        return read("page") + "\n" + read("bridge") + "\nwindow.__minddumpDrive(function (chrome) {\n" + read("content") + "\n});";
    }

    private String read(String name) throws IOException {
        try (InputStream in = getActivity().getAssets().open("public/drive/" + name + ".js")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
}
