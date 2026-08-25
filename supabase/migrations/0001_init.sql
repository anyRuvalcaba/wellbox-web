-- WellBox schema
-- Run via Supabase CLI (supabase db push) or paste into the SQL editor.

create extension if not exists "pgcrypto";

-- ── menus ──────────────────────────────────────────────────────────────────
create table menus (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- only one menu can be published at a time
create unique index one_published_menu on menus (is_published) where is_published = true;

-- ── menu_days ──────────────────────────────────────────────────────────────
create table menu_days (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references menus(id) on delete cascade,
  day_date date not null,
  day_label text not null,
  position int not null default 0
);
create index menu_days_menu_id_idx on menu_days(menu_id);

-- ── dishes ─────────────────────────────────────────────────────────────────
create table dishes (
  id uuid primary key default gen_random_uuid(),
  menu_day_id uuid not null references menu_days(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  photo_url text,
  position int not null default 0
);
create index dishes_menu_day_id_idx on dishes(menu_day_id);

-- ── option_groups ──────────────────────────────────────────────────────────
create table option_groups (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references dishes(id) on delete cascade,
  label text not null,
  type text not null check (type in ('single', 'multiple')),
  is_required boolean not null default false,
  position int not null default 0
);
create index option_groups_dish_id_idx on option_groups(dish_id);

-- ── option_choices ─────────────────────────────────────────────────────────
create table option_choices (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references option_groups(id) on delete cascade,
  label text not null,
  extra_cost numeric(10,2) not null default 0,
  position int not null default 0
);
create index option_choices_option_group_id_idx on option_choices(option_group_id);

-- ── orders ─────────────────────────────────────────────────────────────────
create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  delivery_type text not null default 'delivery' check (delivery_type in ('delivery', 'pickup')),
  delivery_address text,
  notes text,
  total numeric(10,2) not null default 0,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'transfer_uploaded', 'confirmed')),
  transfer_proof_url text,
  created_at timestamptz not null default now(),
  menu_id uuid references menus(id) on delete set null
);
create index orders_menu_id_idx on orders(menu_id);
create index orders_created_at_idx on orders(created_at desc);

-- ── order_items ────────────────────────────────────────────────────────────
-- dish_name/day_label/day_date/unit_price are snapshots so historical orders
-- stay intact even if the dish or menu is later edited or deleted.
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  dish_id uuid references dishes(id) on delete set null,
  dish_name text not null,
  day_label text not null,
  day_date date not null,
  unit_price numeric(10,2) not null
);
create index order_items_order_id_idx on order_items(order_id);

-- ── order_item_options ─────────────────────────────────────────────────────
create table order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  option_group_label text not null,
  chosen_option_label text not null,
  extra_cost numeric(10,2) not null default 0
);
create index order_item_options_order_item_id_idx on order_item_options(order_item_id);

-- ── settings ───────────────────────────────────────────────────────────────
create table settings (
  key text primary key,
  value text
);

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────

alter table menus enable row level security;
alter table menu_days enable row level security;
alter table dishes enable row level security;
alter table option_groups enable row level security;
alter table option_choices enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_options enable row level security;
alter table settings enable row level security;

-- menus: anyone can see the published menu, admins (authenticated) see/manage all
create policy "public can read published menus" on menus
  for select using (is_published = true);
create policy "authenticated manage menus" on menus
  for all to authenticated using (true) with check (true);

create policy "public can read days of published menus" on menu_days
  for select using (exists (select 1 from menus m where m.id = menu_days.menu_id and m.is_published));
create policy "authenticated manage menu_days" on menu_days
  for all to authenticated using (true) with check (true);

create policy "public can read dishes of published menus" on dishes
  for select using (
    exists (
      select 1 from menu_days d join menus m on m.id = d.menu_id
      where d.id = dishes.menu_day_id and m.is_published
    )
  );
create policy "authenticated manage dishes" on dishes
  for all to authenticated using (true) with check (true);

create policy "public can read option_groups of published menus" on option_groups
  for select using (
    exists (
      select 1 from dishes dh
      join menu_days d on d.id = dh.menu_day_id
      join menus m on m.id = d.menu_id
      where dh.id = option_groups.dish_id and m.is_published
    )
  );
create policy "authenticated manage option_groups" on option_groups
  for all to authenticated using (true) with check (true);

create policy "public can read option_choices of published menus" on option_choices
  for select using (
    exists (
      select 1 from option_groups og
      join dishes dh on dh.id = og.dish_id
      join menu_days d on d.id = dh.menu_day_id
      join menus m on m.id = d.menu_id
      where og.id = option_choices.option_group_id and m.is_published
    )
  );
create policy "authenticated manage option_choices" on option_choices
  for all to authenticated using (true) with check (true);

-- orders: anyone can place an order, only admins can read/update them
create policy "public can create orders" on orders
  for insert to anon, authenticated with check (true);
create policy "authenticated read orders" on orders
  for select to authenticated using (true);
create policy "authenticated update orders" on orders
  for update to authenticated using (true) with check (true);

create policy "public can create order_items" on order_items
  for insert to anon, authenticated with check (true);
create policy "authenticated read order_items" on order_items
  for select to authenticated using (true);

create policy "public can create order_item_options" on order_item_options
  for insert to anon, authenticated with check (true);
create policy "authenticated read order_item_options" on order_item_options
  for select to authenticated using (true);

-- settings: bank details / whatsapp number need to be readable by customers
create policy "public can read settings" on settings
  for select using (true);
create policy "authenticated manage settings" on settings
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────
-- Storage
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('dish-photos', 'dish-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

create policy "public read dish photos" on storage.objects
  for select using (bucket_id = 'dish-photos');
create policy "authenticated manage dish photos" on storage.objects
  for all to authenticated using (bucket_id = 'dish-photos') with check (bucket_id = 'dish-photos');

create policy "public upload payment proofs" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'payment-proofs');
create policy "authenticated read payment proofs" on storage.objects
  for select to authenticated using (bucket_id = 'payment-proofs');
