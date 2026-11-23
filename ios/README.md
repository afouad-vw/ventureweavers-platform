# VentureWeavers for iPhone (test build)

The member app (https://app.ventureweavers.com) full screen in a native app, exactly as it is on the web.
Anything you change on the website shows in the app straight away; there is nothing to rebuild.

## Put it on your iPhone

1. Open `VentureWeavers.xcodeproj` in Xcode 16 or later.
2. Click the **VentureWeavers** project, then the **VentureWeavers** target, then **Signing & Capabilities**.
   Tick **Automatically manage signing** and pick your **Team** (your Apple ID works).
   If Xcode says the bundle identifier is taken, change `com.ventureweavers.app` to something of your own, e.g. `com.ventureweavers.app.ahmed`.
3. Plug in your iPhone (or pick it from the device list if it's on the same Wi-Fi), choose it at the top of Xcode and press **Run** (▶).
4. First time only, on the iPhone: Settings › General › VPN & Device Management › your Apple ID › **Trust**.
   If iOS asks, also turn on Settings › Privacy & Security › **Developer Mode** and restart.

With a free Apple ID the app stops opening after 7 days; press Run again to refresh it.

## How it behaves

- Opens app.ventureweavers.com; you stay signed in between launches.
- VentureWeavers pages, sign-in steps (Google, LinkedIn, the Cloudflare check) stay in the app; other links (YouTube, Instagram, LinkedIn profiles, email, WhatsApp) open in their own apps or Safari.
- Swipe from the left edge to go back. Portrait on iPhone.
- No connection: a "Try again" screen.
