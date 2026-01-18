insert into public.wrap_models (name, slug, manufacturer, sort_order)
values
  ('Model Y', 'model-y', 'Tesla', 10),
  ('Model 3', 'model-3', 'Tesla', 20),
  ('Cybertruck', 'cybertruck', 'Tesla', 30)
on conflict (slug) do update
set name = excluded.name,
    manufacturer = excluded.manufacturer,
    sort_order = excluded.sort_order,
    is_active = true;

with models as (
  select id, slug from public.wrap_models where slug in ('model-y','model-3','cybertruck')
),
upsert_wraps as (
  insert into public.wraps (name, slug, category, image_url, thumbnail_url, source, attribution, sort_order)
  values
    ('Ani', 'tesla-examples-ani', 'tesla-examples', 'https://cdn.tewan.club/wraps/tesla-examples/Ani.png', null, 'tesla-examples', null, 10),
    ('Camo Blue', 'tesla-examples-camo-blue', 'tesla-examples', 'https://cdn.tewan.club/wraps/tesla-examples/Camo_Blue.png', null, 'tesla-examples', null, 20),
    ('Cosmic Burst', 'tesla-examples-cosmic-burst', 'tesla-examples', 'https://cdn.tewan.club/wraps/tesla-examples/Cosmic_Burst.png', null, 'tesla-examples', null, 30),
    ('Doge Camo', 'tesla-examples-doge-camo', 'tesla-examples', 'https://cdn.tewan.club/wraps/tesla-examples/Doge_Camo.png', null, 'tesla-examples', null, 40),
    ('Gradient Black', 'tesla-examples-gradient-black', 'tesla-examples', 'https://cdn.tewan.club/wraps/tesla-examples/Gradient_Black.png', null, 'tesla-examples', null, 50),
    ('Gradient Sunburst', 'tesla-examples-gradient-sunburst', 'tesla-examples', 'https://cdn.tewan.club/wraps/tesla-examples/Gradient_Sunburst.png', null, 'tesla-examples', null, 60),
    ('Leopard', 'tesla-examples-leopard', 'tesla-examples', 'https://cdn.tewan.club/wraps/tesla-examples/Leopard.png', null, 'tesla-examples', null, 70),
    ('Rudi', 'tesla-examples-rudi', 'tesla-examples', 'https://cdn.tewan.club/wraps/tesla-examples/Rudi.png', null, 'tesla-examples', null, 80),
    ('Valentine', 'tesla-examples-valentine', 'tesla-examples', 'https://cdn.tewan.club/wraps/tesla-examples/Valentine.png', null, 'tesla-examples', null, 90),
    ('Xray', 'tesla-examples-xray', 'tesla-examples', 'https://cdn.tewan.club/wraps/tesla-examples/Xray.png', null, 'tesla-examples', null, 100)
  on conflict (slug) do update
  set name = excluded.name,
      category = excluded.category,
      image_url = excluded.image_url,
      thumbnail_url = excluded.thumbnail_url,
      source = excluded.source,
      attribution = excluded.attribution,
      sort_order = excluded.sort_order,
      is_active = true
  returning id, slug
)
insert into public.wrap_model_map (wrap_id, model_id)
select w.id as wrap_id, m.id as model_id
from upsert_wraps w
cross join models m
on conflict do nothing;
