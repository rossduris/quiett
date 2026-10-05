# Quiett Auth setup (Supabase + Apple + Google)

Live Quiett requires an account (Apple and Google). Camera and motion stay on-device.

App code: `src/lib/supabase.ts`, `src/lib/auth-provider.tsx`, Profile → `AccountRow`.
Bundle ID: `com.rossduris.quiett` · Team: `JZ8YVDHL4P` · Domain: `quiett.app` · Support: `hello@quiett.app`.

## Env

Copy `.env.example` → `.env.local` (gitignored) and set:

- `EXPO_PUBLIC_SUPABASE_URL` — `https://saplbvmhcbdflgkzbnvt.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Dashboard → Project Settings → API → anon / publishable

Never put `service_role` in the app. Restart Metro after changing env (`npx expo start -c`).

## Supabase Dashboard

Project ref: `saplbvmhcbdflgkzbnvt`.

1. **Authentication → URL Configuration**
   - Site URL: `https://quiett.app` (or your staging URL).
   - Redirect URLs (add all you use):
     - `quiett://auth/callback`
     - Expo Go / tunnel URLs if you test there (from `makeRedirectUri` logs in `__DEV__`).
2. **Authentication → Providers → Apple** — enable.
   - **Client IDs**: add `com.rossduris.quiett` (native App ID / bundle ID).
   - If you also use Apple **web** OAuth later: create a Services ID, put it **first** in Client IDs, and set Team ID + secret (`.p8` rotation every 6 months). Native-only does **not** need the secret.
   - Expo Go testing also needs `host.exp.Exponent` in Client IDs.
3. **Authentication → Providers → Google** — enable.
   - Paste the **Web** OAuth Client ID + Client Secret from Google Cloud (see below).
   - Add iOS/Android client IDs to the Client IDs list if you later switch to native Google Sign-In.
4. **profiles** table — migration `supabase/migrations/20261005135000_create_profiles.sql` (already applied on this project). RLS: owner read/insert/update only.

## Apple Developer (Mindful Labs · JZ8YVDHL4P)

1. Identifiers → App ID `com.rossduris.quiett` → enable **Sign in with Apple**.
2. Xcode / EAS: capability **Sign in with Apple** (Expo plugin `expo-apple-authentication` + `ios.usesAppleSignIn` in `app.json`).
3. Rebuild the native app after enabling (`npx expo run:ios` or EAS). Apple Sign In does not work in a stock Expo Go build for a custom bundle ID the same way as a dev client.
4. **TODO (Ross):** confirm App ID capability; do not invent Services ID / Key IDs in code — configure only in Apple Console + Supabase Dashboard.

## Google Cloud

1. Create (or open) a Google Cloud project for Quiett.
2. APIs & Services → **OAuth consent screen** (app name Quiett, support `hello@quiett.app`, domain `quiett.app`).
3. **Credentials → Create OAuth client ID → Web application**
   - Authorized redirect URI: `https://saplbvmhcbdflgkzbnvt.supabase.co/auth/v1/callback`
   - Copy Client ID + Secret into Supabase → Google provider.
4. Optional later: separate **iOS** client (`com.rossduris.quiett`) and **Android** client (SHA-1) for native Google Sign-In. This pass uses **browser OAuth** via `expo-web-browser` / `expo-auth-session`, so the **Web** client is required; no Google client ID is embedded in the app.
5. **TODO (Ross):** create the Web client and paste IDs into Supabase — do not invent client IDs in the repo.

## How the app signs in

| Provider | Flow |
|----------|------|
| Apple (iOS) | `expo-apple-authentication` → `supabase.auth.signInWithIdToken({ provider: 'apple' })` |
| Google | `signInWithOAuth` + `WebBrowser.openAuthSessionAsync` → deep link `quiett://auth/callback` |

Session persistence: Supabase Auth storage = AsyncStorage.

## Test checklist

1. `.env.local` present; Metro restarted with cache clear.
2. Dev build with Sign in with Apple capability (`npx expo run:ios --device`).
3. Profile → Account: Apple + Google buttons (ACCOUNT_UI is on).
4. Apple: complete sheet → session shows email/name → Sign out.
5. Google: browser consent → returns to app → session → Sign out.
6. Confirm a row appears in Supabase **Authentication → Users** and `public.profiles`.

## Out of scope this pass

RevenueCat linking to `user.id`, streak sync, and forcing auth before Home. Leave purchases alone.
