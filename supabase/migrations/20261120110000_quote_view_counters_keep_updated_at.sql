-- Proposal view logging writes view_count / first_viewed_at / last_viewed_at.
-- Through the shared update_workspace_updated_at() trigger that bumped
-- quotes.updated_at on every client view, which (a) made a customer's accept
-- fail its "prices changed since you loaded the page" check whenever anyone
-- else opened the link, and (b) moved the quote's "last edited" in the OS.
--
-- quotes gets its own trigger function: updated_at moves on any change EXCEPT
-- one that touches only the view counters. The shared function is untouched.

create or replace function public.quotes_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - array['updated_at', 'view_count', 'first_viewed_at', 'last_viewed_at'])
     = (to_jsonb(old) - array['updated_at', 'view_count', 'first_viewed_at', 'last_viewed_at']) then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_updated_at on quotes;
create trigger quotes_updated_at
  before update on quotes
  for each row execute function public.quotes_touch_updated_at();
