package fr.minddump.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        openShared(getIntent());
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
