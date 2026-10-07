// Quiett: delete-account Edge Function.
//
// Deletes the calling user's Quiett account: their app data (public.profiles, plus anything
// else that references auth.users with ON DELETE CASCADE) and then the Supabase Auth user.
// Required by App Review guideline 5.1.1(v) because Quiett offers Sign in with Apple.
//
// Deployed with verify_jwt = true, so the platform rejects requests without a valid JWT
// before this code runs. We still resolve the user from the bearer token ourselves (getUser
// checks it against Auth), and only ever delete that user. The service role key comes from
// the function env (SUPABASE_SERVICE_ROLE_KEY is injected by default) and never leaves here.
//
// Local alarm, streak and settings data live on the phone and are not touched.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed', message: 'Use POST.' });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return json(401, { ok: false, error: 'unauthorized', message: 'Missing bearer token.' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    console.error('[delete-account] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return json(500, { ok: false, error: 'server_misconfigured', message: 'Server is not configured.' });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Who is calling? getUser(jwt) validates the token with Auth (rejects anon/service keys,
  // expired tokens and users that no longer exist).
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return json(401, { ok: false, error: 'unauthorized', message: 'Invalid or expired session.' });
  }

  // App data. profiles.id references auth.users ON DELETE CASCADE, so deleteUser below would
  // remove it anyway; deleting explicitly keeps this correct if that FK ever changes.
  // Add any future user-owned tables here (or give them an ON DELETE CASCADE FK to auth.users).
  const { error: profileError } = await admin.from('profiles').delete().eq('id', user.id);
  if (profileError) {
    console.error('[delete-account] profiles delete failed', profileError.message);
    return json(500, { ok: false, error: 'delete_data_failed', message: 'Could not delete account data.' });
  }

  // Hard delete. Also removes the user's identities, sessions and refresh tokens. Already
  // issued access tokens stay valid until they expire, so the app signs out locally too.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('[delete-account] auth deleteUser failed', deleteError.message);
    return json(500, { ok: false, error: 'delete_user_failed', message: 'Could not delete the account.' });
  }

  return json(200, { ok: true });
});
