import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client for Quiett Auth (Apple + Google).
 * Session persists via AsyncStorage (standard RN practice; SecureStore has size limits).
 * Never use the service_role key in the app — anon + RLS only.
 *
 * Console setup (Apple Developer, Google Cloud, Supabase redirect URLs): see docs/AUTH-SETUP.md.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

/** True when URL + anon key are present (release should ship with both). */
export function isSupabaseConfigured(): boolean {
  return url.length > 0 && anonKey.length > 0;
}

/**
 * Lazy client so missing env does not crash Metro / Expo Go.
 * Callers should check `isSupabaseConfigured()` before sign-in.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
    );
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** Deep-link redirect for OAuth (Google). Must be allow-listed in Supabase Auth → URL Configuration. */
export const AUTH_REDIRECT_PATH = 'auth/callback';
