-- Add a one-level parent/child hierarchy for customer-facing merchant business categories.
alter table public.merchant_categories
  add column if not exists parent_id uuid
  references public.merchant_categories(id) on delete set null;

create index if not exists merchant_categories_parent_sort_idx
  on public.merchant_categories(parent_id, is_active, sort_order, name);

create or replace function public.guard_merchant_category_hierarchy()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'A category cannot be its own parent.';
    end if;
    if exists (
      select 1 from public.merchant_categories parent
      where parent.id = new.parent_id and parent.parent_id is not null
    ) then
      raise exception 'Only top-level categories can be parents.';
    end if;
    if exists (
      select 1 from public.merchant_categories child
      where child.parent_id = new.id
    ) then
      raise exception 'A category with subcategories cannot become a subcategory.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists merchant_category_hierarchy_guard on public.merchant_categories;
create trigger merchant_category_hierarchy_guard
before insert or update of parent_id on public.merchant_categories
for each row execute function public.guard_merchant_category_hierarchy();
