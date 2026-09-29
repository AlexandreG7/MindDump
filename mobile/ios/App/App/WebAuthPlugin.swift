import AuthenticationServices
import Capacitor

/// Connexion Google / Apple depuis l'app (docs/app-mobile.md, étape 3.2).
///
/// Google refuse l'OAuth dans une WebView embarquée : la page de connexion
/// s'ouvre dans ASWebAuthenticationSession (navigateur système, recommandé par
/// Apple et Google), qui se referme d'elle-même quand le serveur redirige vers
/// `minddump://auth?code=…` et rend cette URL au JavaScript du site
/// (src/lib/mobileSignIn.ts).
@objc(WebAuthPlugin)
public class WebAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "WebAuthPlugin"
    public let jsName = "WebAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise)
    ]

    private var session: ASWebAuthenticationSession?

    @objc func start(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString),
              let scheme = call.getString("callbackScheme") else {
            call.reject("url et callbackScheme requis")
            return
        }

        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callbackURL, error in
                self?.session = nil
                if let callbackURL = callbackURL {
                    call.resolve(["url": callbackURL.absoluteString])
                } else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    call.reject("Connexion annulée", "CANCELED")
                } else {
                    call.reject(error?.localizedDescription ?? "La connexion a échoué")
                }
            }
            session.presentationContextProvider = self
            // Partage les cookies de Safari : un compte Google déjà connecté
            // n'a pas à retaper son mot de passe.
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            session.start()
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}

/// Contrôleur principal : le pont Capacitor, plus les plugins propres à l'app.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WebAuthPlugin())
    }
}
