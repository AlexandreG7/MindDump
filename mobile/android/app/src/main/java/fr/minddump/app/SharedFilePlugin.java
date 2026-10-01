package fr.minddump.app;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

/**
 * Fichier partagé en attente pour l'import IA (page /importer?shared=1) :
 * MainActivity le prépare, la page le prend une seule fois. Passé en base64
 * plutôt que par URL : la WebView est sur https://minddump.fr et ne peut pas
 * lire un fichier local d'une autre origine.
 */
@CapacitorPlugin(name = "SharedFile")
public class SharedFilePlugin extends Plugin {

    private static File pendingFile;
    private static String pendingName;
    private static String pendingMimeType;

    static synchronized void setPending(File file, String name, String mimeType) {
        clearPending();
        pendingFile = file;
        pendingName = name;
        pendingMimeType = mimeType;
    }

    private static synchronized void clearPending() {
        if (pendingFile != null) pendingFile.delete();
        pendingFile = null;
        pendingName = null;
        pendingMimeType = null;
    }

    @PluginMethod
    public void take(PluginCall call) {
        File file;
        String name;
        String mimeType;
        synchronized (SharedFilePlugin.class) {
            file = pendingFile;
            name = pendingName;
            mimeType = pendingMimeType;
            pendingFile = null;
            pendingName = null;
            pendingMimeType = null;
        }
        if (file == null) {
            // Capacitor ne sait pas rendre null : un objet sans `data`.
            call.resolve();
            return;
        }
        try {
            byte[] bytes = new byte[(int) file.length()];
            try (FileInputStream in = new FileInputStream(file)) {
                int read = 0;
                while (read < bytes.length) {
                    int n = in.read(bytes, read, bytes.length - read);
                    if (n < 0) break;
                    read += n;
                }
            }
            JSObject result = new JSObject();
            result.put("name", name);
            result.put("mimeType", mimeType);
            result.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
            call.resolve(result);
        } catch (IOException e) {
            call.reject("Fichier partagé illisible");
        } finally {
            file.delete();
        }
    }
}
