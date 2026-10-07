-- Trigger-only: revoke RPC access to SECURITY DEFINER handle_new_user.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres, service_role;
