-- เว็บเช็คชื่ออบรม (ตัวเรียบ)

create table public.trainings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  training_date date not null,
  created_at timestamptz not null default now()
);

create table public.attendees (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  checked_in_at timestamptz,
  unique (training_id, name)
);
create index attendees_training_id_idx on public.attendees(training_id);

-- แอดมิน = อีเมลเดียว
create or replace function public.is_admin()
returns boolean language sql stable
set search_path = ''
as $$ select coalesce(auth.jwt()->>'email', '') = 'chaokoh.ex@gmail.com' $$;

alter table public.trainings enable row level security;
alter table public.attendees enable row level security;

-- อ่าน/เขียนตรงได้เฉพาะแอดมิน; ผู้เข้าอบรมใช้ฟังก์ชันด้านล่างเท่านั้น
create policy trainings_admin_all on public.trainings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy attendees_admin_all on public.attendees
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ผู้เข้าอบรม: ดูการอบรมหนึ่งรายการ (ต้องรู้ id จาก QR)
create or replace function public.get_training(p_training_id uuid)
returns jsonb language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id, 'title', t.title, 'training_date', t.training_date,
    'attendees', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'checked_in_at', a.checked_in_at) order by a.name)
      from public.attendees a where a.training_id = t.id), '[]'::jsonb))
  from public.trainings t where t.id = p_training_id
$$;

-- ผู้เข้าอบรม: เช็คชื่อ (ครั้งเดียว ไม่ทับเวลาเดิม)
create or replace function public.check_in(p_attendee_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = ''
as $$
declare v_time timestamptz;
begin
  update public.attendees set checked_in_at = now()
   where id = p_attendee_id and checked_in_at is null
  returning checked_in_at into v_time;
  if v_time is not null then
    return jsonb_build_object('ok', true, 'checked_in_at', v_time);
  end if;
  select checked_in_at into v_time from public.attendees where id = p_attendee_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  return jsonb_build_object('ok', false, 'reason', 'already', 'checked_in_at', v_time);
end $$;

revoke all on function public.get_training(uuid) from public;
revoke all on function public.check_in(uuid) from public;
grant execute on function public.get_training(uuid) to anon, authenticated;
grant execute on function public.check_in(uuid) to anon, authenticated;

alter publication supabase_realtime add table public.attendees;
