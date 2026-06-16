create table if not exists sources (
  id text primary key,
  country text not null,
  name text not null,
  type text,
  site_url text,
  feed_url text,
  default_topic text,
  enabled boolean not null default true
);

create table if not exists signals (
  id text primary key,
  country text not null,
  source text not null,
  source_type text,
  topic text not null,
  priority text not null,
  title text not null,
  summary text,
  url text not null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists signals_country_idx on signals(country);
create index if not exists signals_priority_idx on signals(priority);
create index if not exists signals_published_at_idx on signals(published_at desc);
