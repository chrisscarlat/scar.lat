-- scar.lat image likes / dislikes (Front Style project, own table).
-- Written only by the scarlat-vote edge function (service role). No IP address
-- is ever stored: only country / city, or "Unknown (VPN/proxy)" for visitors
-- coming through a cloud / hosting / relay network.

create table if not exists public.scarlat_votes (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  client_ts    timestamptz,
  image        text not null check (char_length(image) <= 500),
  project      text check (char_length(project) <= 120),
  vote         text not null check (vote in ('like', 'dislike', 'none')),
  lang         text check (char_length(lang) <= 10),
  device       text check (device in ('mobile', 'desktop')),
  country      text,
  country_code text,
  city         text,                               -- null when the lookup has no city
  location     text not null default 'Unknown',    -- "City, Country" | "Country" | "Unknown (VPN/proxy)" | "Unknown"
  via_proxy    boolean not null default false
);

alter table public.scarlat_votes enable row level security;
-- no policies on purpose: the public (anon) key can neither read nor write
revoke all on public.scarlat_votes from anon, authenticated;

-- Clean-up: any row whose location names a cloud / hosting / relay provider
-- (or its data-centre city) becomes "Unknown (VPN/proxy)".
update public.scarlat_votes
   set location = 'Unknown (VPN/proxy)', country = null, country_code = null, city = null, via_proxy = true
 where location ~* '(amazon|aws|google cloud|microsoft|azure|cloudflare|akamai|apple|private relay|fastly|digitalocean|hetzner|ovh|linode|oracle)'
    or via_proxy;

-- Stats: likes / dislikes per country and city; rows without a city are
-- grouped under their country as "City unknown".
create or replace view public.scarlat_vote_stats with (security_invoker = true) as
select
  case when via_proxy then 'Unknown (VPN/proxy)' else coalesce(country, 'Unknown') end as country,
  case when via_proxy then '—' else coalesce(nullif(city, ''), 'City unknown') end      as city,
  project,
  image,
  count(*) filter (where vote = 'like')    as likes,
  count(*) filter (where vote = 'dislike') as dislikes,
  count(*)                                 as total
from public.scarlat_votes
group by 1, 2, 3, 4;

revoke all on public.scarlat_vote_stats from anon, authenticated;
