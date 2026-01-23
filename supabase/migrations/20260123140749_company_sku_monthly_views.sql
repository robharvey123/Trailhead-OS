create or replace view vw_sell_in_customer_sku_monthly as
select
  workspace_id,
  brand,
  customer,
  product,
  date_trunc('month', date)::date as month,
  sum(qty_cans) as sell_in_units,
  sum(promo_cans) as promo_units,
  sum(qty_cans + promo_cans) as total_shipped,
  sum(coalesce(total, qty_cans * unit_price)) as revenue
from sell_in
group by workspace_id, brand, customer, product, date_trunc('month', date)::date;

create or replace view vw_sell_out_company_sku_monthly as
select
  workspace_id,
  brand,
  company,
  product,
  date_trunc('month', month)::date as month,
  sum(units) as sell_out_units
from sell_out
group by workspace_id, brand, company, product, date_trunc('month', month)::date;
