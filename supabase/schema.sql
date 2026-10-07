-- Burger House Craft: rode este arquivo inteiro no SQL Editor do Supabase.
create extension if not exists pgcrypto;

create table public.settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'Burger House Craft',
  description text default '', address text default '', whatsapp text default '', pix_key text default '', hours text default '',
  delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  min_order numeric(10,2) not null default 0 check (min_order >= 0),
  social_url text default '', headline text default '', accept_scheduled boolean not null default true,
  logo_url text, banner_url text
);
create table public.categories (id uuid primary key default gen_random_uuid(), name text not null, position int not null default 0);
create table public.addons (id uuid primary key default gen_random_uuid(), name text not null, price numeric(10,2) not null check (price >= 0), image_url text, active boolean not null default true, position int not null default 0);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null, description text default '', price numeric(10,2) not null check (price >= 0), image_url text,
  active boolean not null default true, position int not null default 0,
  addon_min int not null default 0 check (addon_min >= 0), addon_max int not null default 0 check (addon_max >= 0)
);
create table public.product_addons (product_id uuid references public.products(id) on delete cascade, addon_id uuid references public.addons(id) on delete cascade, primary key (product_id, addon_id));
create table public.orders (
  id bigint generated always as identity (start with 101) primary key,
  token uuid not null default gen_random_uuid(),
  customer_name text not null, phone text not null, mode text not null check (mode in ('entrega','retirada')),
  address text default '', notes text default '', scheduled_for timestamptz,
  subtotal numeric(10,2) not null, delivery_fee numeric(10,2) not null default 0, total numeric(10,2) not null,
  status int not null default 0 check (status between 0 and 6), items jsonb not null, created_at timestamptz not null default now()
);

-- Segurança (RLS): o público só LÊ o cardápio ativo; qualquer escrita e a leitura de pedidos exigem login do dono.
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.addons enable row level security;
alter table public.products enable row level security;
alter table public.product_addons enable row level security;
alter table public.orders enable row level security;
create policy ler on public.settings for select using (true);
create policy ler on public.categories for select using (true);
create policy ler on public.addons for select using (active);
create policy ler on public.products for select using (active);
create policy ler on public.product_addons for select using (true);
create policy dono on public.settings for all to authenticated using (true) with check (true);
create policy dono on public.categories for all to authenticated using (true) with check (true);
create policy dono on public.addons for all to authenticated using (true) with check (true);
create policy dono on public.products for all to authenticated using (true) with check (true);
create policy dono on public.product_addons for all to authenticated using (true) with check (true);
create policy dono on public.orders for all to authenticated using (true) with check (true);

-- Criação de pedido: o SERVIDOR valida tudo e recalcula os preços (o cliente não consegue mandar valor falso).
create or replace function public.create_order(p_name text, p_phone text, p_mode text, p_address text, p_notes text, p_scheduled timestamptz, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cfg public.settings; el jsonb; pr public.products; qty int; ids uuid[]; n int; avail int; got int; addsum numeric; unit numeric; adl jsonb;
  lines jsonb := '[]'::jsonb; sub numeric := 0; fee numeric := 0; oid bigint; tok uuid; ph text;
begin
  select * into cfg from public.settings where id = 1;
  ph := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Informe seu nome'; end if;
  if length(ph) < 10 or length(ph) > 13 then raise exception 'Telefone inválido'; end if;
  if p_mode not in ('entrega','retirada') then raise exception 'Forma de recebimento inválida'; end if;
  if p_mode = 'entrega' and length(trim(coalesce(p_address,''))) < 8 then raise exception 'Informe o endereço completo'; end if;
  if p_scheduled is not null and (not cfg.accept_scheduled or p_scheduled < now()) then raise exception 'Data de agendamento inválida'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then raise exception 'Carrinho vazio'; end if;
  for el in select value from jsonb_array_elements(p_items) loop
    select * into pr from public.products where id = (el->>'product_id')::uuid and active;
    if not found then raise exception 'Um dos produtos não está mais disponível'; end if;
    qty := (el->>'qty')::int;
    if qty is null or qty < 1 or qty > 50 then raise exception 'Quantidade inválida'; end if;
    select coalesce(array_agg(distinct x::uuid), '{}'::uuid[]) into ids from jsonb_array_elements_text(coalesce(el->'addons','[]'::jsonb)) x;
    n := coalesce(array_length(ids,1), 0);
    select count(*) into avail from public.product_addons pa join public.addons a on a.id = pa.addon_id where pa.product_id = pr.id and a.active;
    select count(*), coalesce(sum(a.price),0), coalesce(jsonb_agg(jsonb_build_object('name',a.name,'price',a.price)),'[]'::jsonb)
      into got, addsum, adl
      from public.product_addons pa join public.addons a on a.id = pa.addon_id where pa.product_id = pr.id and a.active and a.id = any(ids);
    if got <> n then raise exception 'Adicional inválido'; end if;
    if got < least(pr.addon_min, avail) or (pr.addon_max > 0 and got > pr.addon_max) then raise exception 'Quantidade de adicionais inválida em %', pr.name; end if;
    unit := pr.price + addsum; sub := sub + unit * qty;
    lines := lines || jsonb_build_array(jsonb_build_object('name',pr.name,'qty',qty,'unit',unit,'note',left(coalesce(el->>'note',''),200),'addons',adl));
  end loop;
  if sub < cfg.min_order then raise exception 'Pedido mínimo de R$ %', to_char(cfg.min_order,'FM999990.00'); end if;
  if p_mode = 'entrega' then fee := cfg.delivery_fee; end if;
  insert into public.orders(customer_name,phone,mode,address,notes,scheduled_for,subtotal,delivery_fee,total,items)
    values (trim(p_name), ph, p_mode, coalesce(trim(p_address),''), left(coalesce(p_notes,''),300), p_scheduled, sub, fee, sub + fee, lines)
    returning id, token into oid, tok;
  return jsonb_build_object('id', oid, 'token', tok);
end $$;

create or replace function public.get_order(p_id bigint, p_token uuid) returns jsonb language sql security definer set search_path = public as $$
  select to_jsonb(o) - 'token' from public.orders o where o.id = p_id and o.token = p_token $$;
grant execute on all functions in schema public to anon, authenticated;

-- Imagens e avisos em tempo real
insert into storage.buckets (id, name, public) values ('media','media',true) on conflict (id) do nothing;
create policy media_ler on storage.objects for select using (bucket_id = 'media');
create policy media_dono on storage.objects for all to authenticated using (bucket_id = 'media') with check (bucket_id = 'media');
alter publication supabase_realtime add table public.orders;

-- Dados iniciais (edite tudo depois pelo painel)
insert into public.settings (id, name, description, hours, delivery_fee, min_order, headline)
values (1, 'Burger House Craft', 'Hambúrgueres artesanais feitos na hora, com o sabor original.', 'Todos os dias, 18h às 23h', 5, 15, 'Original Taste! Peça online e pague via PIX.');
insert into public.categories (name, position) values ('🍔 Lanches',1),('🌭 Hot Dogs',2),('🍟 Porções',3),('🥤 Bebidas',4),('🍨 Sobremesas',5);
insert into public.addons (name, price, position) values ('+1 Carne 180g',8,1),('Queijo Cheddar',3,2),('Bacon',4,3),('Ovo',2,4);
insert into public.products (category_id, name, description, price, position)
  select c.id, v.n, v.d, v.p, v.o from (values
    ('🍔 Lanches','Classic Burger','Pão brioche, carne 180g, queijo, alface e tomate.',28,1),
    ('🍔 Lanches','Double Craft','Duas carnes 180g, cheddar e molho da casa.',38,2),
    ('🍔 Lanches','Bacon Flame','Carne 180g, bacon crocante e molho barbecue.',34,3),
    ('🌭 Hot Dogs','Hot Dog Tradicional','Salsicha, purê, batata palha e molhos.',18,1),
    ('🍟 Porções','Batata Frita','Porção crocante para dividir.',20,1),
    ('🥤 Bebidas','Refrigerante Lata','350 ml.',6,1),
    ('🍨 Sobremesas','Brownie','Brownie de chocolate com calda.',12,1)
  ) as v(cat,n,d,p,o) join public.categories c on c.name = v.cat;
insert into public.product_addons (product_id, addon_id)
  select p.id, a.id from public.products p join public.categories c on c.id = p.category_id cross join public.addons a
  where c.name = '🍔 Lanches' or (c.name = '🌭 Hot Dogs' and a.name <> '+1 Carne 180g') or (c.name = '🍟 Porções' and a.name in ('Queijo Cheddar','Bacon'));
