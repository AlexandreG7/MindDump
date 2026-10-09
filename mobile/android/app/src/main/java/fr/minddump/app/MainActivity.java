package fr.minddump.app;

import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    /** Minuteries de la surcouche de lancement (filet de 8 s, retrait différé). */
    private final Handler launchHandler = new Handler(Looper.getMainLooper());

    private static final String GO_BACK_SCRIPT =
        "(function(){var n=window.navigation;if(n&&n.canGoBack){history.back();return true}return false})()";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Écran de lancement système : retiré d'un coup (sans fondu) dès que
        // l'activité est dessinée, car la vue launch_overlay (même logo, même
        // position, plus le message) est déjà dessous. Un fondu ferait clignoter
        // le logo entre les deux.
        SplashScreen.installSplashScreen(this).setOnExitAnimationListener(splashScreenView -> splashScreenView.remove());
        registerPlugin(SharedFilePlugin.class);
        registerPlugin(MatchDrivePlugin.class);
        super.onCreate(savedInstanceState);
        // Fond clair ou sombre selon le téléphone tant que la page n'est pas
        // affichée (res/values*/colors.xml) : pas d'éclair blanc en mode sombre.
        bridge.getWebView().setBackgroundColor(ContextCompat.getColor(this, R.color.app_background));
        // Seulement au démarrage à froid : si Android recrée l'activité à chaud
        // (processus tué en arrière-plan, rotation...), la page se recharge sans
        // rejouer l'animation web (sessionStorage est déjà posé) et la surcouche
        // resterait figée jusqu'au filet de 8 s.
        if (savedInstanceState == null) showLaunchOverlay();
        // Bouton retour : page précédente du site, sinon l'app passe en
        // arrière-plan comme toute app Android. WebView.canGoBack() ignore les
        // navigations internes du site (history.pushState) : on demande à la
        // Navigation API de la page. Le gestionnaire du plugin App est
        // désactivé (capacitor.config.ts) : il ne faisait rien à la racine.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                bridge.getWebView().evaluateJavascript(GO_BACK_SCRIPT, (wentBack) -> {
                    if (!"true".equals(wentBack)) moveTaskToBack(true);
                });
            }
        });
        openShared(getIntent());
    }

    /**
     * Première image de l'app (docs/app-intro.md) : Android 12+ n'accepte pas de
     * texte dans l'écran de lancement système (logo seul, sur le fond de l'app).
     * Cette vue, identique à la première image de l'animation web (logo de 96 dp
     * centré, message 72 dp sous le centre), prend le relais dès que l'activité
     * est dessinée et reste jusqu'à ce que la page ait peint : le passage
     * natif -> web ne fait ni flash ni saut.
     */
    private void showLaunchOverlay() {
        final View overlay = LayoutInflater.from(this).inflate(R.layout.launch_overlay, null);
        addContentView(overlay, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        final Handler handler = launchHandler;
        final Runnable remove = () -> {
            if (overlay.getParent() instanceof ViewGroup) ((ViewGroup) overlay.getParent()).removeView(overlay);
        };
        // Filet de sécurité : site injoignable, page d'erreur... on ne bloque jamais l'écran.
        handler.postDelayed(remove, 8000);
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                // Attend que la WebView ait réellement peint la page (et son overlay d'intro).
                webView.postVisualStateCallback(1, new WebView.VisualStateCallback() {
                    @Override
                    public void onComplete(long requestId) {
                        handler.postDelayed(remove, 50);
                    }
                });
            }
        });
    }

    @Override
    public void onDestroy() {
        // Pas de référence à l'activité détruite via les minuteries en attente.
        launchHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openShared(intent);
    }

    /**
     * « Partager → MindDump » depuis une autre app (docs/app-mobile.md, étape
     * 3.4) : le texte ou le lien reçu est confié à la page /partager du site,
     * qui importe une recette HelloFresh / Jow / Quitoque ou propose d'en faire
     * une tâche.
     */
    private void openShared(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        Uri stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (stream != null && intent.getType() != null && !intent.getType().startsWith("text/")) {
            openSharedFile(stream, intent.getType());
            intent.setAction(Intent.ACTION_MAIN);
            return;
        }
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.trim().isEmpty()) return;
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);

        Uri.Builder url = Uri.parse(bridge.getServerUrl()).buildUpon().path("/partager").appendQueryParameter("text", text);
        if (subject != null && !subject.trim().isEmpty()) url.appendQueryParameter("title", subject);
        String target = url.build().toString();

        // Au démarrage à froid, Capacitor vient de lancer le chargement de la
        // page d'accueil : on passe derrière lui.
        bridge.getWebView().post(() -> bridge.getWebView().loadUrl(target));
        // Un même partage ne doit pas être rejoué au retour dans l'app.
        intent.setAction(Intent.ACTION_MAIN);
    }

    /** Taille maximale d'une image envoyée à l'import IA (plus grand côté). */
    private static final int MAX_IMAGE_SIDE = 2000;

    /**
     * Image ou PDF partagé : préparé pour l'import IA, puis /importer?shared=1
     * le récupère par le plugin SharedFile. Les photos sont remises en JPEG
     * (le serveur refuse le HEIC), redressées et réduites à 2000 px de côté.
     */
    private void openSharedFile(Uri uri, String mimeType) {
        String target = Uri.parse(bridge.getServerUrl()).buildUpon().path("/importer")
            .appendQueryParameter("shared", "1").build().toString();
        new Thread(() -> {
            try {
                prepareSharedFile(uri, mimeType);
            } catch (IOException | RuntimeException e) {
                // La page s'ouvre quand même, en import manuel.
            }
            bridge.getWebView().post(() -> bridge.getWebView().loadUrl(target));
        }).start();
    }

    private void prepareSharedFile(Uri uri, String mimeType) throws IOException {
        File dir = new File(getCacheDir(), "shared");
        dir.mkdirs();
        File out = new File(dir, "pending");
        String name = displayName(uri);

        if (mimeType.startsWith("image/") && !mimeType.equals("image/gif")) {
            Bitmap bitmap = decodeScaled(uri);
            if (bitmap != null) {
                try (OutputStream os = new FileOutputStream(out)) {
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 85, os);
                }
                bitmap.recycle();
                String base = name.contains(".") ? name.substring(0, name.lastIndexOf('.')) : name;
                SharedFilePlugin.setPending(out, base + ".jpg", "image/jpeg");
                return;
            }
            // Format que l'appareil ne sait pas lire : le serveur dira lequel.
        }
        try (InputStream in = getContentResolver().openInputStream(uri);
             OutputStream os = new FileOutputStream(out)) {
            if (in == null) throw new IOException("flux vide");
            byte[] buffer = new byte[64 * 1024];
            int n;
            while ((n = in.read(buffer)) > 0) os.write(buffer, 0, n);
        }
        SharedFilePlugin.setPending(out, name, mimeType);
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst() && !c.isNull(0)) return c.getString(0);
        } catch (RuntimeException ignored) {}
        return "document";
    }

    private Bitmap decodeScaled(Uri uri) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            BitmapFactory.decodeStream(in, null, bounds);
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

        // Sous-échantillonnage au décodage (mémoire), puis mise à l'échelle exacte.
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = 1;
        int longest = Math.max(bounds.outWidth, bounds.outHeight);
        while (longest / (options.inSampleSize * 2) >= MAX_IMAGE_SIDE) options.inSampleSize *= 2;
        Bitmap bitmap;
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            bitmap = BitmapFactory.decodeStream(in, null, options);
        }
        if (bitmap == null) return null;

        Matrix matrix = new Matrix();
        float scale = Math.min(1f, (float) MAX_IMAGE_SIDE / Math.max(bitmap.getWidth(), bitmap.getHeight()));
        if (scale < 1f) matrix.postScale(scale, scale);
        int rotation = exifRotation(uri);
        if (rotation != 0) matrix.postRotate(rotation);
        if (matrix.isIdentity()) return bitmap;
        Bitmap result = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
        if (result != bitmap) bitmap.recycle();
        return result;
    }

    private int exifRotation(Uri uri) {
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) return 0;
            switch (new ExifInterface(in).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                case ExifInterface.ORIENTATION_ROTATE_90: return 90;
                case ExifInterface.ORIENTATION_ROTATE_180: return 180;
                case ExifInterface.ORIENTATION_ROTATE_270: return 270;
                default: return 0;
            }
        } catch (IOException | RuntimeException e) {
            return 0;
        }
    }

    /**
     * La WebView n'écrit ses cookies sur disque que périodiquement : une app
     * fermée juste après la connexion perdait sa session. On les écrit dès que
     * l'app passe en arrière-plan.
     */
    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
