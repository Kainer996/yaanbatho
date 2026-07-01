# Burbz — Android App Guide

Burbz is Android-ready as a **Trusted Web Activity (TWA)**: the real game stays
on yaanbatho.com and the Android app is a thin, Play-Store-installable shell
around it. Users get a normal app icon, fullscreen play, and every update you
ship to the website appears in the app instantly — no re-releases.

Everything the wrapper needs already ships with the game:

| Requirement            | Where                                             | Status |
|------------------------|---------------------------------------------------|--------|
| Web app manifest       | `public/burbz/manifest.json`                      | ✅ standalone, portrait, icons 48→512 + maskable |
| Service worker         | `public/burbz/sw.js`                              | ✅ offline shell caching |
| Icons                  | `public/burbz/icons/`                             | ✅ in repo |
| HTTPS                  | yaanbatho.com                                     | ✅ |
| Digital Asset Links    | `.well-known/assetlinks.json`                     | ⚠️ needs your signing fingerprint (step 4) |
| TWA config             | `android/twa-manifest.json`                       | ✅ |

## Build the APK/AAB (one-time setup ~15 min)

Requires Node 18+ and a JDK (Bubblewrap can auto-install its own JDK/SDK).

```bash
npm i -g @bubblewrap/cli
cd android
bubblewrap init --manifest https://yaanbatho.com/burbz/manifest.json
# Accept the defaults it reads from twa-manifest.json / the web manifest.
# When asked to create a signing key: YES — remember the passwords!
bubblewrap build
```

Outputs:
- `app-release-signed.apk` — installable directly on any Android phone
  ("install from unknown sources"). Perfect for sharing with friends.
- `app-release-bundle.aab` — what you upload to the Google Play Console.

## Remove the "running in Chrome" bar (Digital Asset Links)

Until Android can verify you own yaanbatho.com, the app shows a small browser
bar. To remove it:

1. Get your signing fingerprint:
   `keytool -list -v -keystore android.keystore | grep SHA256`
   (or copy it from Play Console → Setup → App integrity after first upload)
2. Paste it into `.well-known/assetlinks.json` in this repo, replacing
   `REPLACE_WITH_SHA256_FINGERPRINT_...`
3. Deploy so it's live at `https://yaanbatho.com/.well-known/assetlinks.json`
4. Reinstall the app — fullscreen, no bar.

## Play Store notes

- Package id: `com.yaanbatho.burbz` (change in `twa-manifest.json` before the
  first upload if you prefer another).
- One-time Google Play developer registration fee ($25).
- The game asks for microphone (bird sound ID), camera (photo scan), and
  location (nearby birds / map). Play requires a privacy policy URL —
  `https://yaanbatho.com/burbz/privacy.html` already exists and ships in this
  repo.
- `locationDelegation` is enabled in the TWA config so geolocation prompts
  work natively inside the app.

## Alternative: Capacitor (only if you later need native plugins)

If Burbz ever needs true native APIs (background audio recording, push
notifications, in-app purchases), wrap it with Capacitor instead:
`npm i @capacitor/core @capacitor/android`, point `webDir`/server URL at the
game, `npx cap add android`, open in Android Studio. For everything the game
does today, the TWA route above is lighter and updates itself.
