create or replace view vw_sell_out_platform_monthly as
select
  workspace_id,
  brand,
  coalesce(nullif(platform, ''), 'Unknown') as platform,
  date_trunc('month', month)::date as month,
  sum(units) as sell_out_units
from sell_out
group by
  workspace_id,
  brand,
  coalesce(nullif(platform, ''), 'Unknown'),
  date_trunc('month', month)::date;

create or replace view vw_sell_out_region_monthly as
select
  workspace_id,
  brand,
  coalesce(nullif(region, ''), 'Unknown') as region,
  date_trunc('month', month)::date as month,
  sum(units) as sell_out_units
from sell_out
group by
  workspace_id,
  brand,
  coalesce(nullif(region, ''), 'Unknown'),
  date_trunc('month', month)::date;
