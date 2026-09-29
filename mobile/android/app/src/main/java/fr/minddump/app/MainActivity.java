package fr.minddump.app;

import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

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
