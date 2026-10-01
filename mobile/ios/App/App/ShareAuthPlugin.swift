import Capacitor
import Foundation

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
