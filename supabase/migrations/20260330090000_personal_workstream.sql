insert into workstreams (slug, label, colour, sort_order)
values ('personal', 'Personal', 'blue', 6)
on conflict (slug) do update
set
  label = excluded.label,
  colour = excluded.colour,
  sort_order = excluded.sort_order;

insert into board_columns (workstream_id, label, sort_order)
select w.id, col.label, col.sort_order
from workstreams w
cross join (
  values
    ('Backlog', 0),
    ('In progress', 1),
    ('Review', 2),
    ('Done', 3)
) as col(label, sort_order)
where w.slug = 'personal'
  and not exists (
    select 1
    from board_columns bc
    where bc.workstream_id = w.id
      and bc.label = col.label
  );
