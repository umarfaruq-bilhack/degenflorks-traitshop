-- Degen Florks Trait Shop schema

create table traits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,            -- 'hat' | 'clothes' | 'accessory' | 'eyes' | etc.
  image_url text not null,           -- transparent PNG layer, aligned to base canvas
  rarity_tier text not null,         -- 'common' | 'uncommon' | 'rare' | 'legendary'
  price_eth numeric not null,        -- price snapshot in ETH (also mirrored on-chain)
  on_chain_trait_id int unique,      -- maps to traitId used in the smart contract
  source text default 'new',         -- 'original_generation' | 'new'
  active boolean default true,
  created_at timestamptz default now()
);

create table owned_traits (
  id uuid primary key default gen_random_uuid(),
  token_id int not null,             -- Degen Florks tokenId
  trait_id uuid references traits(id),
  owner_wallet text not null,
  tx_hash text not null,
  purchased_at timestamptz default now(),
  unique (token_id, trait_id)
);

create table equipped_traits (
  token_id int not null,
  category text not null,
  trait_id uuid references traits(id),
  updated_at timestamptz default now(),
  primary key (token_id, category)
);

-- Helpful indexes
create index idx_owned_traits_token on owned_traits(token_id);
create index idx_equipped_traits_token on equipped_traits(token_id);
create index idx_traits_category on traits(category);
