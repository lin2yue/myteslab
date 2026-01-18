create extension if not exists pgcrypto;

create table if not exists public.wrap_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  manufacturer text not null default 'Tesla',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug)
);

create table if not exists public.wraps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  category text,
  image_url text not null,
  thumbnail_url text,
  source text,
  attribution text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug)
);

create table if not exists public.wrap_model_map (
  wrap_id uuid not null references public.wraps(id) on delete cascade,
  model_id uuid not null references public.wrap_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wrap_id, model_id)
);

create index if not exists idx_wraps_is_active on public.wraps(is_active);
create index if not exists idx_wrap_models_is_active on public.wrap_models(is_active);
create index if not exists idx_wrap_model_map_model on public.wrap_model_map(model_id);
create index if not exists idx_wrap_model_map_wrap on public.wrap_model_map(wrap_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_wrap_models_updated_at') then
    create trigger trg_wrap_models_updated_at
    before update on public.wrap_models
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_wraps_updated_at') then
    create trigger trg_wraps_updated_at
    before update on public.wraps
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

