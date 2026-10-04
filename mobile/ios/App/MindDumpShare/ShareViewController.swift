import UIKit
import UniformTypeIdentifiers

/// « Partager → MindDump » (docs/app-mobile.md, étape 3.4).
///
/// L'extension travaille seule, sans ouvrir l'app : un lien de recette
/// HelloFresh / Jow / Quitoque est importé, tout autre lien ou texte devient
/// une tâche. Elle s'authentifie avec le jeton lié à l'appareil que l'app a
/// rangé dans le trousseau partagé (ShareAuthPlugin, src/lib/nativeDevice.ts).
/// Mêmes règles que la page /partager du site (src/lib/share.ts).
class ShareViewController: UIViewController {

    private static let accent = UIColor(red: 0xE6 / 255, green: 0x80 / 255, blue: 0x37 / 255, alpha: 1)

    private let card = UIView()
    private let icon = UIImageView()
    private let spinner = UIActivityIndicatorView(style: .large)
    private let titleLabel = UILabel()
    private let detailLabel = UILabel()
    private let button = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        buildInterface()
        show(.working("Envoi à MindDump…"))
        Task { await run() }
    }

    // MARK: - Partage

    private enum RecipeSource: String {
        case hellofresh, jow, quitoque

        var path: String { "/api/recipes/import-\(rawValue)" }
    }

    private struct Shared {
        var title = ""
        var text = ""
        var url: String?
    }

    private func run() async {
        guard let session = SharedKeychain.load(), let token = session["token"], let server = session["server"],
              let base = URL(string: server) else {
            show(.failure("Connecte-toi dans l'app", "Ouvre MindDump une fois connecté, puis partage à nouveau."))
            return
        }

        let shared = await readShared()
        if let source = recipeSource(shared.url), let url = shared.url {
            show(.working("Import de la recette…"))
            let result = await post(base, source.path, token, ["url": url])
            switch result {
            case .success(let body):
                let name = (body["title"] as? String).flatMap { $0.isEmpty ? nil : $0 }
                show(.success("Recette importée ✓", name ?? "Elle t'attend dans tes recettes."))
            case .failure(let message):
                show(.failure("Import impossible", message))
            }
            return
        }

        let title = todoTitle(shared)
        guard !title.isEmpty else {
            show(.failure("Rien à ajouter", "Ce partage ne contient ni lien ni texte."))
            return
        }
        var body: [String: Any] = ["title": title]
        if let url = shared.url, url != title { body["description"] = url }
        switch await post(base, "/api/todos", token, body) {
        case .success:
            show(.success("Tâche créée ✓", title))
        case .failure(let message):
            show(.failure("Tâche non créée", message))
        }
    }

    private func readShared() async -> Shared {
        var shared = Shared()
        let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
        for item in items {
            if shared.title.isEmpty, let title = item.attributedContentText?.string.trimmingCharacters(in: .whitespacesAndNewlines) {
                shared.title = title
            }
            for provider in item.attachments ?? [] {
                if shared.url == nil, provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                   let url = await load(provider, UTType.url) as? URL, !url.isFileURL {
                    shared.url = url.absoluteString
                } else if shared.text.isEmpty, provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                          let text = await load(provider, UTType.plainText) as? String {
                    shared.text = text.trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
        }
        if shared.url == nil { shared.url = firstLink(in: shared.text) ?? firstLink(in: shared.title) }
        // Le titre de page qu'envoie Safari vaut souvent le lien lui-même.
        if shared.title == shared.url { shared.title = "" }
        return shared
    }

    private func load(_ provider: NSItemProvider, _ type: UTType) async -> NSSecureCoding? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: type.identifier, options: nil) { item, _ in
                continuation.resume(returning: item)
            }
        }
    }

    private func firstLink(in text: String) -> String? {
        guard let range = text.range(of: #"https?://\S+"#, options: .regularExpression) else { return nil }
        return String(text[range])
    }

    /// Mêmes règles que `recipeSource` dans src/lib/share.ts : seule une URL de
    /// recette précise compte. Une page de liste, l'accueil ou une autre page
    /// du site retombe sur "autre lien" (donc une tâche).
    ///
    /// Pas de cible XCTest dans ce module : la table ci-dessous reprend les
    /// mêmes cas que le test `npm run test:import-url`
    /// (src/lib/importUrl.test.ts). À tenir à jour ensemble.
    ///
    /// URL                                                                              → résultat
    /// https://www.hellofresh.fr/recipes/poulet-roti-au-citron-6192a1f3a6b8c9001234abcd  → .hellofresh
    /// https://www.hellofresh.co.uk/recipes/chicken-pie-6192a1f3a6b8c9001234abcd?x=1     → .hellofresh
    /// https://www.hellofresh.fr/recipes/                                               → nil (page de liste)
    /// https://www.hellofresh.fr/recipes/under-30-minutes                               → nil (collection, pas d'id)
    /// https://www.hellofresh.fr/                                                        → nil (accueil)
    /// https://hellofresh.fr.evil.com/recipes/x-6192a1f3a6b8c9001234abcd                 → nil (domaine usurpé)
    /// https://jow.fr/recipes/crepes-maison-83jq25q5innb780q0wzk                         → .jow
    /// https://jow.fr/en/recipes/pancakes-83jq25q5innb780q0wzk                           → .jow
    /// https://jow.fr/recipes/                                                           → nil (page de liste)
    /// https://jow.fr/                                                                   → nil (accueil)
    /// https://www.quitoque.fr/recettes/poulet-tikka-masala                              → .quitoque
    /// https://www.quitoque.fr/recettes                                                  → nil (page de liste)
    /// https://www.quitoque.fr/recettes/recettes-de-saison                               → nil (collection)
    /// https://www.quitoque.fr/                                                          → nil (accueil)
    /// https://www.marmiton.org/recettes/poulet.aspx                                     → nil (autre site)
    private func recipeSource(_ url: String?) -> RecipeSource? {
        guard let url = url, let parsedUrl = URL(string: url), let host = parsedUrl.host?.lowercased() else { return nil }
        let path = URLComponents(url: parsedUrl, resolvingAgainstBaseURL: false)?.path ?? parsedUrl.path
        func matches(_ pattern: String, _ value: String) -> Bool {
            value.range(of: pattern, options: .regularExpression) != nil
        }
        // hellofresh.fr, .com, .be, .co.uk… mais pas hellofresh.fr.autre-site.com
        // Il faut un identifiant hexadécimal après "/recipes/" : "/recipes/<slug>-<id>".
        if matches(#"(^|\.)hellofresh\.([a-z]{2,3}|co\.uk|com\.au)$"#, host),
           matches(#"/recipes/[^/?#]+-[0-9a-f]{20,}(?:[/?#]|$)"#, path) {
            return .hellofresh
        }
        // jow.fr/(en/)recipes/<slug>-<id>
        if matches(#"(^|\.)jow\.fr$"#, host),
           matches(#"/(en/)?recipes/[^?#]+-[a-z0-9]{16,}(?:[?#]|$)"#, url) {
            return .jow
        }
        // quitoque.fr/recettes/<slug> uniquement (pas /recettes seul, ni
        // /recettes/recettes-de-saison qui est une collection).
        if matches(#"(^|\.)quitoque\.fr$"#, host) {
            let segments = path.split(separator: "/").map(String.init)
            if segments.count == 2, segments[0] == "recettes", segments[1] != "recettes-de-saison" {
                return .quitoque
            }
        }
        return nil
    }

    /// Le titre partagé, sinon le texte sans le lien, sinon le lien.
    private func todoTitle(_ shared: Shared) -> String {
        var text = shared.text
        if let url = shared.url { text = text.replacingOccurrences(of: url, with: "") }
        text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = !shared.title.isEmpty ? shared.title : !text.isEmpty ? text : shared.url ?? ""
        return String(title.prefix(200))
    }

    // MARK: - Réseau

    private enum PostResult {
        case success([String: Any])
        case failure(String)
    }

    private func post(_ base: URL, _ path: String, _ token: String, _ body: [String: Any]) async -> PostResult {
        guard let url = URL(string: path, relativeTo: base) else { return .failure("Adresse du serveur invalide.") }
        var request = URLRequest(url: url, timeoutInterval: 60)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            if (200..<300).contains(status) { return .success(json) }
            if status == 401 {
                return .failure("Ta connexion a expiré : ouvre MindDump, puis partage à nouveau.")
            }
            return .failure(json["error"] as? String ?? "Le serveur a répondu \(status).")
        } catch {
            return .failure("Pas de connexion : réessaie quand tu seras en ligne.")
        }
    }

    // MARK: - Interface

    private enum State {
        case working(String)
        case success(String, String)
        case failure(String, String)
    }

    private func buildInterface() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.25)

        card.backgroundColor = .systemBackground
        card.layer.cornerRadius = 20
        card.layer.cornerCurve = .continuous
        card.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(card)

        icon.contentMode = .scaleAspectFit
        icon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 40, weight: .semibold)
        spinner.color = Self.accent

        titleLabel.font = .preferredFont(forTextStyle: .headline)
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0

        detailLabel.font = .preferredFont(forTextStyle: .subheadline)
        detailLabel.adjustsFontForContentSizeCategory = true
        detailLabel.textColor = .secondaryLabel
        detailLabel.textAlignment = .center
        detailLabel.numberOfLines = 3

        button.setTitle("Fermer", for: .normal)
        button.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        button.tintColor = Self.accent
        button.addTarget(self, action: #selector(close), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [icon, spinner, titleLabel, detailLabel, button])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 10
        stack.setCustomSpacing(16, after: detailLabel)
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            card.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.8),
            card.widthAnchor.constraint(lessThanOrEqualToConstant: 360),
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 24),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            titleLabel.widthAnchor.constraint(equalTo: stack.widthAnchor),
            detailLabel.widthAnchor.constraint(equalTo: stack.widthAnchor),
        ])
    }

    private func show(_ state: State) {
        DispatchQueue.main.async { [self] in
            switch state {
            case .working(let message):
                icon.isHidden = true
                spinner.isHidden = false
                spinner.startAnimating()
                titleLabel.text = message
                detailLabel.text = nil
                detailLabel.isHidden = true
                button.isHidden = true
            case .success(let title, let detail):
                display(symbol: "checkmark.circle.fill", color: Self.accent, title, detail)
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { [weak self] in self?.close() }
            case .failure(let title, let detail):
                display(symbol: "exclamationmark.circle.fill", color: .systemRed, title, detail)
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
        }
    }

    private func display(symbol: String, color: UIColor, _ title: String, _ detail: String) {
        spinner.stopAnimating()
        spinner.isHidden = true
        icon.image = UIImage(systemName: symbol)
        icon.tintColor = color
        icon.isHidden = false
        titleLabel.text = title
        detailLabel.text = detail
        detailLabel.isHidden = false
        button.isHidden = false
    }

    @objc private func close() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
