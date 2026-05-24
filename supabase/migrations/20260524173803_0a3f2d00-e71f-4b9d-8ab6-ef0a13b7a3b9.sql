
-- ============ ENUMS ============
create type public.app_role as enum ('superadmin', 'course_manager');
create type public.entry_status as enum ('draft', 'published', 'archived');
create type public.display_sort as enum ('newest', 'hole', 'year');

-- ============ COURSES ============
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text not null default '#0f5132',
  secondary_color text not null default '#f3f4f6',
  public_enabled boolean not null default true,
  display_sort public.display_sort not null default 'newest',
  data_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_slug_idx on public.courses (slug);

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_superadmin(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = 'superadmin'
  )
$$;

-- ============ COURSE MANAGERS ============
create table public.course_managers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index course_managers_user_idx on public.course_managers (user_id);
create index course_managers_course_idx on public.course_managers (course_id);

create or replace function public.is_course_manager(_user_id uuid, _course_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.course_managers
    where user_id = _user_id and course_id = _course_id
  )
$$;

-- ============ ENTRIES ============
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  golfer_name text not null,
  date_achieved date not null,
  hole_number integer not null check (hole_number between 1 and 18),
  yardage integer,
  club text,
  witness text,
  photo_url text,
  notes text,
  status public.entry_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index entries_course_status_idx on public.entries (course_id, status);
create index entries_course_date_idx on public.entries (course_id, date_achieved desc);

-- ============ AUDIT LOG ============
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_course_idx on public.audit_logs (course_id, created_at desc);

-- entry trigger: bump course data_version + write audit log
create or replace function public.handle_entry_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  _course_id uuid;
  _action text;
  _before jsonb;
  _after jsonb;
begin
  if tg_op = 'INSERT' then
    _course_id := new.course_id;
    _action := 'create';
    _before := null;
    _after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    _course_id := new.course_id;
    _action := 'update';
    _before := to_jsonb(old);
    _after := to_jsonb(new);
    new.updated_at := now();
  else
    _course_id := old.course_id;
    _action := 'delete';
    _before := to_jsonb(old);
    _after := null;
  end if;

  -- bump data_version when published entries change visibly
  if (_action = 'create' and (new.status = 'published'))
     or (_action = 'update' and (old.status = 'published' or new.status = 'published'))
     or (_action = 'delete' and old.status = 'published') then
    update public.courses set data_version = data_version + 1, updated_at = now()
      where id = _course_id;
  end if;

  insert into public.audit_logs (course_id, user_id, action, entity, entity_id, before, after)
  values (
    _course_id,
    coalesce(new.updated_by, new.created_by, old.updated_by, old.created_by, auth.uid()),
    _action,
    'entry',
    coalesce(new.id, old.id),
    _before,
    _after
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger entries_audit_trigger
  before insert or update or delete on public.entries
  for each row execute function public.handle_entry_change();

-- course change → bump data_version (branding etc.)
create or replace function public.handle_course_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.logo_url is distinct from new.logo_url
     or old.primary_color is distinct from new.primary_color
     or old.secondary_color is distinct from new.secondary_color
     or old.display_sort is distinct from new.display_sort
     or old.name is distinct from new.name then
    new.data_version := old.data_version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger courses_bump_version
  before update on public.courses
  for each row execute function public.handle_course_update();

-- ============ DISPLAY HEARTBEATS ============
create table public.display_heartbeats (
  id bigserial primary key,
  course_id uuid not null references public.courses(id) on delete cascade,
  ts timestamptz not null default now(),
  data_version integer,
  last_refresh_at timestamptz,
  client_info jsonb
);
create index display_heartbeats_course_ts_idx on public.display_heartbeats (course_id, ts desc);

create table public.display_alerts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notified_at timestamptz
);
create index display_alerts_open_idx on public.display_alerts (course_id) where closed_at is null;

-- ============ RLS ============
alter table public.courses enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.course_managers enable row level security;
alter table public.entries enable row level security;
alter table public.audit_logs enable row level security;
alter table public.display_heartbeats enable row level security;
alter table public.display_alerts enable row level security;

-- COURSES: anyone authenticated can read (only branding fields exposed by server fns publicly), superadmins write
create policy "courses readable by authenticated"
  on public.courses for select to authenticated using (true);

create policy "superadmin manages courses"
  on public.courses for all to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

-- PROFILES
create policy "users see own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_superadmin(auth.uid()));

create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- USER_ROLES
create policy "superadmin manages roles"
  on public.user_roles for all to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

create policy "users see own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

-- COURSE_MANAGERS
create policy "superadmin manages cm assignments"
  on public.course_managers for all to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

create policy "cm sees own assignments"
  on public.course_managers for select to authenticated
  using (user_id = auth.uid());

-- ENTRIES
create policy "superadmin all entries"
  on public.entries for all to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

create policy "cm reads own course entries"
  on public.entries for select to authenticated
  using (public.is_course_manager(auth.uid(), course_id));

create policy "cm writes own course entries"
  on public.entries for insert to authenticated
  with check (public.is_course_manager(auth.uid(), course_id));

create policy "cm updates own course entries"
  on public.entries for update to authenticated
  using (public.is_course_manager(auth.uid(), course_id))
  with check (public.is_course_manager(auth.uid(), course_id));

create policy "cm deletes own course entries"
  on public.entries for delete to authenticated
  using (public.is_course_manager(auth.uid(), course_id));

-- AUDIT LOGS
create policy "superadmin reads all audit"
  on public.audit_logs for select to authenticated
  using (public.is_superadmin(auth.uid()));

create policy "cm reads own course audit"
  on public.audit_logs for select to authenticated
  using (course_id is not null and public.is_course_manager(auth.uid(), course_id));

-- DISPLAY HEARTBEATS
create policy "anyone can insert heartbeat"
  on public.display_heartbeats for insert to anon, authenticated
  with check (true);

create policy "superadmin reads heartbeats"
  on public.display_heartbeats for select to authenticated
  using (public.is_superadmin(auth.uid()));

create policy "cm reads own heartbeats"
  on public.display_heartbeats for select to authenticated
  using (public.is_course_manager(auth.uid(), course_id));

-- DISPLAY ALERTS
create policy "superadmin manages alerts"
  on public.display_alerts for all to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

-- ============ STORAGE BUCKETS ============
insert into storage.buckets (id, name, public)
values ('course-logos', 'course-logos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('entry-photos', 'entry-photos', true)
on conflict (id) do nothing;

-- storage policies
create policy "course logos public read"
  on storage.objects for select
  using (bucket_id = 'course-logos');

create policy "entry photos public read"
  on storage.objects for select
  using (bucket_id = 'entry-photos');

create policy "authenticated upload logos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'course-logos');

create policy "authenticated upload photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-photos');

create policy "authenticated update logos"
  on storage.objects for update to authenticated
  using (bucket_id = 'course-logos');

create policy "authenticated update photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'entry-photos');

create policy "authenticated delete logos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'course-logos');

create policy "authenticated delete photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'entry-photos');
