create or replace view vw_sell_in_monthly as
select
  workspace_id,
  brand,
  date_trunc('month', date)::date as month,
  sum(qty_cans) as sell_in_units,
  sum(promo_cans) as promo_units,
  sum(coalesce(total, qty_cans * unit_price)) as revenue,
  sum(qty_cans + promo_cans) as total_shipped
from sell_in
group by workspace_id, brand, date_trunc('month', date)::date;

create or replace view vw_sell_out_monthly as
select
  workspace_id,
  brand,
  date_trunc('month', month)::date as month,
  sum(units) as sell_out_units
from sell_out
group by workspace_id, brand, date_trunc('month', month)::date;

create or replace view vw_sell_in_customer_monthly as
select
  workspace_id,
  brand,
  customer,
  date_trunc('month', date)::date as month,
  sum(qty_cans) as sell_in_units,
  sum(promo_cans) as promo_units,
  sum(coalesce(total, qty_cans * unit_price)) as revenue,
  sum(qty_cans + promo_cans) as total_shipped
from sell_in
group by workspace_id, brand, customer, date_trunc('month', date)::date;

create or replace view vw_sell_out_company_monthly as
select
  workspace_id,
  brand,
  company,
  date_trunc('month', month)::date as month,
  sum(units) as sell_out_units
from sell_out
group by workspace_id, brand, company, date_trunc('month', month)::date;

create or replace view vw_sell_in_sku_monthly as
select
  workspace_id,
  brand,
  product,
  date_trunc('month', date)::date as month,
  sum(qty_cans) as sell_in_units,
  sum(promo_cans) as promo_units,
  sum(coalesce(total, qty_cans * unit_price)) as revenue,
  sum(qty_cans + promo_cans) as total_shipped
from sell_in
group by workspace_id, brand, product, date_trunc('month', date)::date;

create or replace view vw_sell_out_sku_monthly as
select
  workspace_id,
  brand,
  product,
  date_trunc('month', month)::date as month,
  sum(units) as sell_out_units
from sell_out
group by workspace_id, brand, product, date_trunc('month', month)::date;

create or replace view vw_sell_in_customer_totals as
select
  workspace_id,
  brand,
  customer,
  sum(qty_cans) as sell_in_units,
  sum(promo_cans) as promo_units,
  sum(coalesce(total, qty_cans * unit_price)) as revenue,
  sum(qty_cans + promo_cans) as total_shipped
from sell_in
group by workspace_id, brand, customer;

create or replace view vw_sell_out_company_totals as
select
  workspace_id,
  brand,
  company,
  sum(units) as sell_out_units
from sell_out
group by workspace_id, brand, company;

create or replace view vw_sell_in_customer_match as
select
  customers.workspace_id,
  customers.customer,
  coalesce(mapping.sell_out_company, exact.company, fuzzy.company) as sell_out_company,
  mapping.group_name
from (
  select distinct workspace_id, customer
  from sell_in
) customers
left join customer_mappings mapping
  on mapping.workspace_id = customers.workspace_id
  and lower(mapping.sell_in_customer) = lower(customers.customer)
left join lateral (
  select company
  from sell_out so
  where so.workspace_id = customers.workspace_id
    and lower(so.company) = lower(customers.customer)
  limit 1
) exact on true
left join lateral (
  select company
  from sell_out so
  where so.workspace_id = customers.workspace_id
    and (
      lower(customers.customer) like '%' || lower(so.company) || '%'
      or lower(so.company) like '%' || lower(customers.customer) || '%'
    )
  order by length(so.company) desc
  limit 1
) fuzzy on true;
