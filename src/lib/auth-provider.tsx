import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Alert, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { FunctionsHttpError, type Session, type User } from '@supabase/supabase-js';
import { logOutPurchases } from '@/lib/purchases';
import { AUTH_REDIRECT_PATH, getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  clearAccountLinkedCache,
  SIGNED_OUT_ACCOUNT,
  type AccountData,
  type AccountProvider,
} from '@/lib/storage';

WebBrowser.maybeCompleteAuthSession();

export type AuthOutcome =
  | { ok: true }
  | { ok: false; canceled?: boolean; message: string };

type AuthContextValue = {
  /** Session from Supabase (null when signed out or unconfigured). */
  session: Session | null;
  user: User | null;
  /** Profile-row shape used by AccountRow. */
  account: AccountData;
  loading: boolean;
  configured: boolean;
  signInWithApple: () => Promise<AuthOutcome>;
  signInWithGoogle: () => Promise<AuthOutcome>;
  signOut: () => Promise<AuthOutcome>;
  /**
   * Permanently deletes the Quiett account (Supabase `delete-account` Edge Function), then signs
   * out locally and returns RevenueCat to anonymous. On-device alarm, streak and settings stay.
   */
  deleteAccount: () => Promise<AuthOutcome>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function providerFromUser(user: User | null): AccountProvider {
  const raw = (user?.app_metadata?.provider as string | undefined) ?? null;
  if (raw === 'apple' || raw === 'google') return raw;
  // Linked identities: prefer apple/google if present.
  const identities = user?.identities ?? [];
  for (const id of identities) {
    if (id.provider === 'apple' || id.provider === 'google') return id.provider;
  }
  return null;
}

function accountFromSession(session: Session | null): AccountData {
  if (!session?.user) return { ...SIGNED_OUT_ACCOUNT };
  const user = session.user;
  const meta = user.user_metadata ?? {};
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    null;
  return {
    signedIn: true,
    provider: providerFromUser(user),
    displayName,
    email: user.email ?? null,
  };
}

const DELETE_FAILED_MESSAGE = 'We couldn\u2019t delete your account. Check your connection and try again.';

/** Friendly message for a failed `delete-account` call (details go to the dev console only). */
async function deleteAccountErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response | undefined;
    let body: unknown = null;
    try {
      body = await res?.clone().json();
    } catch {
      body = null;
    }
    if (__DEV__) console.warn('[auth] delete-account failed', res?.status, body);
    if (res?.status === 401) {
      return 'Your session has expired. Sign out, sign in again, then try deleting your account.';
    }
    return DELETE_FAILED_MESSAGE;
  }
  if (__DEV__) console.warn('[auth] delete-account failed', error);
  return DELETE_FAILED_MESSAGE;
}

async function createSessionFromUrl(url: string): Promise<Session | null> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  // PKCE: code in query string.
  const code = params.code;

  const supabase = getSupabase();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  if (!access_token || !refresh_token) return null;
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return data.session;
}

/**
 * Auth for Apple (native) + Google (OAuth browser). Mount once in root layout.
 * RevenueCat logs in with the Supabase user id (see premium-provider / logInPurchases).
 * Google UI is gated by GOOGLE_SIGN_IN_ENABLED in dev-flags.ts.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);
  const alive = useRef(true);

  const redirectTo = useMemo(
    () =>
      makeRedirectUri({
        scheme: 'quiett',
        path: AUTH_REDIRECT_PATH,
      }),
    [],
  );

  useEffect(() => {
    alive.current = true;
    if (!configured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    void supabase.auth.getSession().then(({ data }) => {
      if (!alive.current) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive.current) return;
      setSession(next);
      setLoading(false);
    });

    return () => {
      alive.current = false;
      sub.subscription.unsubscribe();
    };
  }, [configured]);

  // Cold-start / deep-link OAuth callback (Google).
  useEffect(() => {
    if (!configured) return;

    const handleUrl = async (url: string | null) => {
      if (!url || !url.includes(AUTH_REDIRECT_PATH)) return;
      try {
        const next = await createSessionFromUrl(url);
        if (next && alive.current) setSession(next);
      } catch (e) {
        if (__DEV__) console.warn('[auth] deep link session failed', e);
      }
    };

    void Linking.getInitialURL().then((url) => void handleUrl(url));
    const linking = Linking.addEventListener('url', ({ url }) => void handleUrl(url));
    return () => linking.remove();
  }, [configured]);

  const signInWithApple = useCallback(async (): Promise<AuthOutcome> => {
    if (!configured) {
      return { ok: false, message: 'Supabase keys are missing. Add them to .env.local.' };
    }
    if (Platform.OS !== 'ios') {
      return { ok: false, message: 'Sign in with Apple is available on iPhone.' };
    }
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        return { ok: false, message: 'Sign in with Apple is not available on this device.' };
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { ok: false, message: 'Apple did not return an identity token.' };
      }

      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) return { ok: false, message: error.message };

      // Apple only sends the name on the first authorization.
      if (credential.fullName) {
        const parts = [
          credential.fullName.givenName,
          credential.fullName.middleName,
          credential.fullName.familyName,
        ].filter((p): p is string => Boolean(p && p.trim()));
        if (parts.length) {
          await supabase.auth.updateUser({
            data: {
              full_name: parts.join(' '),
              given_name: credential.fullName.givenName,
              family_name: credential.fullName.familyName,
            },
          });
        }
      }

      return { ok: true };
    } catch (e: unknown) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
      if (code === 'ERR_REQUEST_CANCELED') {
        return { ok: false, canceled: true, message: 'Canceled' };
      }
      const message = e instanceof Error ? e.message : 'Apple sign-in failed.';
      return { ok: false, message };
    }
  }, [configured]);

  const signInWithGoogle = useCallback(async (): Promise<AuthOutcome> => {
    if (!configured) {
      return { ok: false, message: 'Supabase keys are missing. Add them to .env.local.' };
    }
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) return { ok: false, message: error.message };
      if (!data.url) return { ok: false, message: 'Google sign-in URL was empty. Enable Google in Supabase Auth.' };

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        return { ok: false, canceled: true, message: 'Canceled' };
      }

      await createSessionFromUrl(result.url);
      return { ok: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Google sign-in failed.';
      return { ok: false, message };
    }
  }, [configured, redirectTo]);

  const signOut = useCallback(async (): Promise<AuthOutcome> => {
    if (!configured) {
      setSession(null);
      return { ok: true };
    }
    try {
      const { error } = await getSupabase().auth.signOut();
      if (error) return { ok: false, message: error.message };
      return { ok: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Sign out failed.';
      return { ok: false, message };
    }
  }, [configured]);

  const deleteAccount = useCallback(async (): Promise<AuthOutcome> => {
    if (!configured) {
      return { ok: false, message: 'Accounts aren\u2019t set up in this build.' };
    }
    const supabase = getSupabase();
    try {
      const { data: current } = await supabase.auth.getSession();
      if (!current.session) {
        return { ok: false, message: 'You\u2019re signed out. Sign in again to delete your account.' };
      }
      // invoke() sends the current access token as the Authorization bearer.
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean }>('delete-account', {
        method: 'POST',
      });
      if (error) return { ok: false, message: await deleteAccountErrorMessage(error) };
      if (!data?.ok) return { ok: false, message: DELETE_FAILED_MESSAGE };
    } catch (e: unknown) {
      return { ok: false, message: await deleteAccountErrorMessage(e) };
    }

    // The account is gone on the server. Local cleanup below is best effort and can't undo that,
    // so it never turns the outcome into a failure.
    try {
      // 'local': the server session was deleted with the user, so don't call the logout endpoint.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      if (__DEV__) console.warn('[auth] local sign-out after delete failed', e);
    }
    if (alive.current) setSession(null);
    // Back to an anonymous RevenueCat customer (guarded: no-op without purchases, never throws).
    // PurchasesUserSync also sees the signed-out session and re-fetches customer info.
    await logOutPurchases();
    await clearAccountLinkedCache();
    return { ok: true };
  }, [configured]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      account: accountFromSession(session),
      loading,
      configured,
      signInWithApple,
      signInWithGoogle,
      signOut,
      deleteAccount,
    }),
    [session, loading, configured, signInWithApple, signInWithGoogle, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Show a non-blocking alert for auth errors (skip canceled). */
export function alertAuthFailure(outcome: AuthOutcome, title = 'Sign in') {
  if (outcome.ok || outcome.canceled) return;
  Alert.alert(title, outcome.message);
}
