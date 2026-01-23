create or replace view vw_sell_in_customer_sku_totals as
select
  workspace_id,
  brand,
  customer,
  product,
  sum(qty_cans) as sell_in_units,
  sum(promo_cans) as promo_units,
  sum(qty_cans + promo_cans) as total_shipped,
  sum(coalesce(total, qty_cans * unit_price)) as revenue
from sell_in
group by workspace_id, brand, customer, product;

create or replace view vw_sell_out_company_sku_totals as
select
  workspace_id,
  brand,
  company,
  product,
  sum(units) as sell_out_units
from sell_out
group by workspace_id, brand, company, product;
