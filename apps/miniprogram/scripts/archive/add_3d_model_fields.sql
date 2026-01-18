alter table public.wrap_models
add column if not exists model_3d_url text;

alter table public.wraps
add column if not exists preview_image_url text;

comment on column public.wrap_models.model_3d_url is 'CDN URL to the 3D model file (.glb)';
comment on column public.wraps.preview_image_url is 'CDN URL to the 3D preview image';
