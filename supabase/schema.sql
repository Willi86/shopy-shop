create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  price numeric(10, 2) not null check (price >= 0),
  image_url text not null,
  stock integer not null default 0 check (stock >= 0),
  category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_address text not null,
  postal_code text not null,
  city text not null,
  status text not null default 'ordered'
    check (
      status in (
        'ordered',
        'processing',
        'delivered',
        'refunded'
      )
    ),
  total_price numeric(10, 2) not null check (total_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders(id)
    on delete cascade,
  product_id uuid
    references public.products(id)
    on delete set null,
  product_name text not null,
  price numeric(10, 2) not null check (price >= 0),
  quantity integer not null check (quantity > 0)
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null
    references public.carts(id)
    on delete cascade,
  product_id uuid not null
    references public.products(id)
    on delete cascade,
  quantity integer not null default 1 check (quantity > 0),

  unique (cart_id, product_id)
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

drop policy if exists "Products can be viewed by everyone"
on public.products;

create policy "Products can be viewed by everyone"
on public.products
for select
to anon, authenticated
using (true);