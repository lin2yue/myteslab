insert into public.wrap_models (name, slug, manufacturer, sort_order)
values
  ('Model Y', 'model-y', 'Tesla', 10)
on conflict (slug) do update
set name = excluded.name,
    manufacturer = excluded.manufacturer,
    sort_order = excluded.sort_order,
    is_active = true;

with model as (
  select id from public.wrap_models where slug = 'model-y'
),
upsert_wraps as (
  insert into public.wraps (name, slug, category, image_url, source, sort_order)
  values
    ('Ani', 'local-modely-2025-performance-ani', 'modely-2025-performance', '/static/wraps/modely-2025-performance/Ani.png', 'local-static', 10),
    ('Apocalypse', 'local-modely-2025-performance-apocalypse', 'modely-2025-performance', '/static/wraps/modely-2025-performance/Apocalypse.png', 'local-static', 20),
    ('Avocado Green', 'local-modely-2025-performance-avocado-green', 'modely-2025-performance', '/static/wraps/modely-2025-performance/Avocado_Green.png', 'local-static', 30),
    ('Cosmic Burst', 'local-modely-2025-performance-cosmic-burst', 'modely-2025-performance', '/static/wraps/modely-2025-performance/Cosmic_Burst.png', 'local-static', 40),
    ('Doge', 'local-modely-2025-performance-doge', 'modely-2025-performance', '/static/wraps/modely-2025-performance/Doge.png', 'local-static', 50),
    ('Leopard', 'local-modely-2025-performance-leopard', 'modely-2025-performance', '/static/wraps/modely-2025-performance/Leopard.png', 'local-static', 60),
    ('Pixel Art', 'local-modely-2025-performance-pixel-art', 'modely-2025-performance', '/static/wraps/modely-2025-performance/Pixel_Art.png', 'local-static', 70),
    ('Sakura', 'local-modely-2025-performance-sakura', 'modely-2025-performance', '/static/wraps/modely-2025-performance/Sakura.png', 'local-static', 80),
    ('Sketch', 'local-modely-2025-performance-sketch', 'modely-2025-performance', '/static/wraps/modely-2025-performance/Sketch.png', 'local-static', 90),
    ('Valentine', 'local-modely-2025-performance-valentine', 'modely-2025-performance', '/static/wraps/modely-2025-performance/Valentine.png', 'local-static', 100)
  on conflict (slug) do update
  set name = excluded.name,
      category = excluded.category,
      image_url = excluded.image_url,
      source = excluded.source,
      sort_order = excluded.sort_order,
      is_active = true
  returning id
)
insert into public.wrap_model_map (wrap_id, model_id)
select w.id as wrap_id, m.id as model_id
from upsert_wraps w
cross join model m
on conflict do nothing;
