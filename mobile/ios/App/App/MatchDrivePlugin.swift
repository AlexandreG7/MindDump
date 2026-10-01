import Capacitor
import UIKit
import WebKit

/// Remplir le panier drive Match depuis une liste (docs/app-mobile.md,
/// étape 3.6).
///
/// Les API de Match ne répondent qu'à une page de leur site : l'écran ouvre
/// donc supermarchesmatch.fr dans une seconde WebView et y injecte les scripts
/// de l'extension navigateur (drive-extension/, copiés dans public/drive/), qui
/// cherchent les produits, affichent la revue et ajoutent au panier avec
/// l'action du site. Leurs appels à MindDump remontent ici puis à la page
/// MindDump de l'app (événement « api », src/lib/matchDrive.ts), qui a la
/// session ; la réponse redescend par reply().
@objc(MatchDrivePlugin)
public class MatchDrivePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MatchDrivePlugin"
    public let jsName = "MatchDrive"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reply", returnType: CAPPluginReturnPromise),
    ]

    /// Liste en attente : le script la prend (takeFill) une fois le site prêt.
    private var pendingListId: String?
    /// Dernière liste lancée, pour le bouton « Remplir le panier ».
    private var lastListId: String?
    private weak var screen: MatchDriveViewController?

    @objc func open(_ call: CAPPluginCall) {
        guard let listId = call.getString("listId"), !listId.isEmpty else {
            call.reject("listId requis")
            return
        }
        guard let script = Self.injectedScript() else {
            call.reject("Scripts Match absents de l'app")
            return
        }
        DispatchQueue.main.async { [self] in
            pendingListId = listId
            lastListId = listId
            if let screen = screen {
                // Écran déjà ouvert : relance directe sur la nouvelle liste.
                pendingListId = nil
                screen.fill(listId)
            } else {
                let controller = MatchDriveViewController(script: script)
                controller.onMessage = { [weak self] body in self?.handle(body) }
                controller.onFill = { [weak self] in self?.relaunch() }
                controller.onClose = { [weak self] in self?.notifyListeners("closed", data: [:]) }
                let navigation = UINavigationController(rootViewController: controller)
                navigation.modalPresentationStyle = .fullScreen
                bridge?.viewController?.present(navigation, animated: true)
                screen = controller
            }
            call.resolve()
        }
    }

    /// Réponse de la page MindDump à un appel « api ».
    @objc func reply(_ call: CAPPluginCall) {
        guard let id = call.getInt("id") else {
            call.reject("id requis")
            return
        }
        let result = call.getObject("result") ?? ["ok": false, "error": "Réponse vide"]
        DispatchQueue.main.async { [self] in
            screen?.reply(id, result)
            call.resolve()
        }
    }

    private func handle(_ body: String) {
        guard let data = body.data(using: .utf8),
              let envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id = envelope["id"] as? Int,
              let message = envelope["message"] as? [String: Any],
              let type = message["type"] as? String else { return }

        switch type {
        case "takeFill":
            screen?.reply(id, ["listId": pendingListId ?? NSNull()])
            pendingListId = nil
        case "api":
            var data: [String: Any] = ["id": id]
            data["method"] = message["method"]
            data["path"] = message["path"]
            data["body"] = message["body"]
            // Gardé si la page MindDump se recharge à ce moment : relayé dès
            // que son écouteur revient (registerMatchDriveRelay).
            notifyListeners("api", data: data, retainUntilConsumed: true)
        default:
            screen?.reply(id, ["ok": false, "error": "Message inconnu"])
        }
    }

    private func relaunch() {
        guard let listId = lastListId else { return }
        screen?.fill(listId)
    }

    /// page.js, le pont, puis content.js dans la portée du pont.
    private static func injectedScript() -> String? {
        func read(_ name: String) -> String? {
            guard let url = Bundle.main.url(forResource: name, withExtension: "js", subdirectory: "public/drive") else { return nil }
            return try? String(contentsOf: url, encoding: .utf8)
        }
        guard let page = read("page"), let bridge = read("bridge"), let content = read("content") else { return nil }
        return "\(page)\n\(bridge)\nwindow.__minddumpDrive(function (chrome) {\n\(content)\n});"
    }
}

/// Écran plein écran : le site Match, avec « Fermer » et « Remplir le panier ».
final class MatchDriveViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    static let home = URL(string: "https://www.supermarchesmatch.fr/fr")!

    var onMessage: ((String) -> Void)?
    var onFill: (() -> Void)?
    var onClose: (() -> Void)?

    private let script: String
    private var webView: WKWebView!

    init(script: String) {
        self.script = script
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) non utilisé") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Panier Match"
        view.backgroundColor = UIColor(named: "AppBackground") ?? .systemBackground
        let accent = UIColor(red: 0xE6 / 255, green: 0x80 / 255, blue: 0x37 / 255, alpha: 1)
        navigationController?.navigationBar.tintColor = accent
        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "Fermer", style: .plain, target: self, action: #selector(close))
        let fill = UIBarButtonItem(title: "Remplir le panier", style: .plain, target: self, action: #selector(fillTapped))
        fill.tintColor = accent
        navigationItem.rightBarButtonItem = fill

        let configuration = WKWebViewConfiguration()
        // L'app déclare WKAppBoundDomains (Info.plist) : l'injection de script
        // n'est permise que dans une WebView limitée à ces domaines, où
        // figurent ceux de Match.
        configuration.limitsNavigationsToAppBoundDomains = true
        configuration.userContentController.addUserScript(
            WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        configuration.userContentController.add(WeakMessageHandler(self), name: "minddumpDrive")

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        webView.load(URLRequest(url: Self.home))
    }

    func fill(_ listId: String) {
        evaluate("window.__minddumpNative && window.__minddumpNative.fill(\(Self.json(listId)))")
    }

    func reply(_ id: Int, _ result: [String: Any]) {
        evaluate("window.__minddumpNative && window.__minddumpNative.reply(\(id), \(Self.json(result)))")
    }

    private func evaluate(_ source: String) {
        webView?.evaluateJavaScript(source, completionHandler: nil)
    }

    private static func json(_ value: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]),
              let text = String(data: data, encoding: .utf8) else { return "null" }
        return text
    }

    private static func isMatch(_ url: URL?) -> Bool {
        guard let host = url?.host?.lowercased() else { return false }
        return host == "supermarchesmatch.fr" || host.hasSuffix(".supermarchesmatch.fr")
    }

    @objc private func close() {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "minddumpDrive")
        dismiss(animated: true)
        onClose?()
    }

    @objc private func fillTapped() {
        onFill?()
    }

    // Seule une page de Match peut parler à l'app.
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, Self.isMatch(message.frameInfo.request.url),
              let body = message.body as? String else { return }
        onMessage?(body)
    }

    // Le site Match reste ici ; tout autre lien part dans le navigateur.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        let mainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        if !mainFrame || Self.isMatch(url) || url?.scheme == "about" || url?.scheme == "blob" {
            decisionHandler(.allow)
            return
        }
        if let url = url, ["http", "https", "mailto", "tel"].contains(url.scheme ?? "") {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    // Liens target="_blank" : même règle, dans cette WebView.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if Self.isMatch(url) { webView.load(URLRequest(url: url)) } else { UIApplication.shared.open(url) }
        }
        return nil
    }
}

/// WKUserContentController retient son gestionnaire : on passe par un
/// intermédiaire faible pour ne pas retenir l'écran.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
