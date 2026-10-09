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
    private var launchOverlay: UIView?
    private var loadingObservation: NSKeyValueObservation?

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WebAuthPlugin())
        bridge?.registerPluginInstance(ShareAuthPlugin())
        bridge?.registerPluginInstance(MatchDrivePlugin())
        // Fond clair ou sombre selon le téléphone tant que la page n'est pas
        // affichée (couleur AppBackground) : pas d'éclair blanc en mode sombre.
        let background = UIColor(named: "AppBackground") ?? .systemBackground
        view.backgroundColor = background
        webView?.backgroundColor = background
        webView?.scrollView.backgroundColor = background
        showLaunchOverlay()
    }

    /// iOS retire l'écran de lancement dès le premier affichage de l'app, bien
    /// avant que la page ait peint : on verrait le fond nu, puis l'animation
    /// d'ouverture apparaître d'un coup. On remet donc la même image (le
    /// storyboard LaunchScreen : logo 96 pt et message, docs/app-intro.md) par-dessus
    /// la WebView jusqu'à ce que la page ait peint, de sorte que le passage
    /// natif -> web ne fasse ni flash ni saut.
    private func showLaunchOverlay() {
        guard let overlay = UIStoryboard(name: "LaunchScreen", bundle: nil).instantiateInitialViewController()?.view else { return }
        overlay.frame = view.bounds
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.isUserInteractionEnabled = true
        view.addSubview(overlay)
        launchOverlay = overlay
        var started = webView?.isLoading ?? false
        loadingObservation = webView?.observe(\.isLoading, options: [.new]) { [weak self] webView, _ in
            if webView.isLoading { started = true; return }
            guard started else { return }
            self?.loadingObservation = nil
            // Deux images plus tard, la page (et son animation) est à l'écran.
            webView.callAsyncJavaScript(
                "await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });",
                arguments: [:], in: nil, in: .page
            ) { _ in self?.hideLaunchOverlay() }
        }
        // Filet de sécurité : site injoignable, page d'erreur... on ne bloque jamais l'écran.
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in self?.hideLaunchOverlay() }
    }

    private func hideLaunchOverlay() {
        loadingObservation = nil
        launchOverlay?.removeFromSuperview()
        launchOverlay = nil
    }
}
