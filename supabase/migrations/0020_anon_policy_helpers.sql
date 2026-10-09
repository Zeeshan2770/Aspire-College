-- The public read policies on news, events and programs call these two helpers,
-- so the anon role needs EXECUTE on them. Both return false when nobody is signed in.
grant execute on function public.can_manage(text) to anon;
grant execute on function public.is_principal() to anon;
