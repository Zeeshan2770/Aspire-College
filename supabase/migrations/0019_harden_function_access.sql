-- Fixed search_path on plain trigger functions
alter function public.set_updated_at() set search_path = public;
alter function public.set_news_published_at() set search_path = public;

-- Anonymous visitors may call ONLY the two public form functions.
-- Everything else that is SECURITY DEFINER is closed to anon/PUBLIC.
-- Signed-in users keep access to the functions the app calls (each one checks the caller's role internally).
-- Trigger-only functions and the student-ID generator are closed to signed-in users as well.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname not in ('submit_admission', 'submit_contact')
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    if r.proname in ('log_table_change', 'prevent_self_privilege_escalation', 'set_created_by', 'next_student_uid') then
      execute format('revoke all on function %s from authenticated', r.sig);
    else
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;
