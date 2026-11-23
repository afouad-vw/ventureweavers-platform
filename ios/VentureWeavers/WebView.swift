import SwiftUI
import UIKit
import WebKit

/// Shared between the web view and the "Try again" screen.
final class WebState: ObservableObject {
    @Published var failed = false
    weak var webView: WKWebView?

    func reload() {
        failed = false
        if let web = webView {
            if web.url == nil { web.load(URLRequest(url: appURL)) } else { web.reload() }
        }
    }
}

/// Hosts that stay inside the app: VentureWeavers itself and the sign-in steps it uses.
private func staysInApp(_ host: String?) -> Bool {
    guard let host = host?.lowercased() else { return false }
    let exact = ["ventureweavers.com", "www.ventureweavers.com", "app.ventureweavers.com", "challenges.cloudflare.com"]
    let suffixes = [".ventureweavers.com", ".supabase.co", "accounts.google.com", ".linkedin.com", "linkedin.com"]
    return exact.contains(host) || suffixes.contains { host.hasSuffix($0) }
}

struct WebView: UIViewRepresentable {
    let url: URL
    let state: WebState

    func makeCoordinator() -> Coordinator { Coordinator(state: state) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // keeps you signed in between launches
        config.allowsInlineMediaPlayback = true
        // Present as mobile Safari so Google's sign-in accepts the app.
        config.applicationNameForUserAgent = "Version/18.0 Mobile/15E148 Safari/604.1"

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 7 / 255, green: 17 / 255, blue: 18 / 255, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        // The site handles the notch and home indicator itself (viewport-fit=cover).
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        state.webView = web
        web.load(URLRequest(url: url))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let state: WebState
        private var popup: UIViewController?

        init(state: WebState) { self.state = state }

        // MARK: Navigation

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { return decisionHandler(.allow) }
            let scheme = url.scheme?.lowercased() ?? ""
            // Email, phone, WhatsApp and other apps.
            if !["http", "https", "about", "blob", "data"].contains(scheme) {
                UIApplication.shared.open(url)
                return decisionHandler(.cancel)
            }
            // Embedded frames (videos, Calendly, Drive, the bot check) always load in place.
            let mainFrame = action.targetFrame?.isMainFrame ?? true
            if mainFrame, ["http", "https"].contains(scheme), !staysInApp(url.host), webView === state.webView {
                UIApplication.shared.open(url) // other sites open in Safari
                return decisionHandler(.cancel)
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            if webView === state.webView { DispatchQueue.main.async { self.state.failed = false } }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            showOffline(webView, error)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            showOffline(webView, error)
        }

        private func showOffline(_ webView: WKWebView, _ error: Error) {
            let e = error as NSError
            guard webView === state.webView, e.code != NSURLErrorCancelled, e.domain == NSURLErrorDomain else { return }
            DispatchQueue.main.async { self.state.failed = true }
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

        // MARK: Windows (Google sign-in opens a popup; other new windows open in Safari)

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            guard let url = action.request.url else { return nil }
            if !staysInApp(url.host) && url.scheme?.hasPrefix("http") == true {
                UIApplication.shared.open(url)
                return nil
            }
            let child = WKWebView(frame: .zero, configuration: configuration)
            child.navigationDelegate = self
            child.uiDelegate = self
            let vc = UIViewController()
            vc.view = child
            vc.modalPresentationStyle = .pageSheet
            popup = vc
            topController()?.present(vc, animated: true)
            return child
        }

        func webViewDidClose(_ webView: WKWebView) {
            if webView !== state.webView { popup?.dismiss(animated: true); popup = nil }
        }

        // MARK: Alerts and confirmations from the site

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            present(a, or: completionHandler)
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
            present(a) { completionHandler(false) }
        }

        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
            let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
            a.addTextField { $0.text = defaultText }
            a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
            present(a) { completionHandler(nil) }
        }

        private func present(_ alert: UIAlertController, or fallback: @escaping () -> Void) {
            guard let top = topController() else { return fallback() }
            top.present(alert, animated: true)
        }

        private func topController() -> UIViewController? {
            let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
            var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController
            while let next = top?.presentedViewController { top = next }
            return top
        }
    }
}
