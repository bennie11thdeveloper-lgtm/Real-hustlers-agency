alter table public.applications
  drop constraint applications_role_check,
  add constraint applications_role_check
    check (char_length(role) between 2 and 120);
