import Capacitor
import Foundation
import Security

/// Trousseau partagé entre l'app et l'extension de partage (docs/app-mobile.md,
/// étape 3.4). Le groupe vient de l'Info.plist (`MindDumpKeychainGroup`,
/// préfixé par l'identifiant d'équipe au build) et doit figurer dans la
/// capacité « Keychain Sharing » des deux cibles.
enum SharedKeychain {
    static let service = "fr.minddump.share"
    static let account = "session"

    static var accessGroup: String? {
        Bundle.main.object(forInfoDictionaryKey: "MindDumpKeychainGroup") as? String
    }

    private static func query() -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        if let group = accessGroup { query[kSecAttrAccessGroup as String] = group }
        return query
    }

    /// `{ "token": "mdt_…", "server": "https://minddump.fr" }`
    static func save(_ value: [String: String]) -> Bool {
        guard let data = try? JSONSerialization.data(withJSONObject: value) else { return false }
        SecItemDelete(query() as CFDictionary)
        var attributes = query()
        attributes[kSecValueData as String] = data
        // L'extension doit pouvoir le lire tant que l'iPhone a été déverrouillé
        // depuis le démarrage.
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        return SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess
    }

    static func load() -> [String: String]? {
        var request = query()
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(request as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: String]
    }

    static func clear() {
        SecItemDelete(query() as CFDictionary)
    }
}

/// Appelé par le site (src/lib/nativeDevice.ts) : range ou efface le jeton de
/// l'extension de partage.
@objc(ShareAuthPlugin)
public class ShareAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShareAuthPlugin"
    public let jsName = "ShareAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    @objc func set(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let server = call.getString("server") else {
            call.reject("token et server requis")
            return
        }
        if SharedKeychain.save(["token": token, "server": server]) {
            call.resolve()
        } else {
            call.reject("Trousseau inaccessible (Keychain Sharing configuré ?)")
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        SharedKeychain.clear()
        call.resolve()
    }
}
