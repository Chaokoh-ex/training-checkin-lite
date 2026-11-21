# เว็บเช็คชื่ออบรม (ตัวเรียบ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เว็บเช็คชื่ออบรมที่ผู้เข้าอบรมสแกน QR แล้วแตะชื่อตัวเอง และแอดมินจัดการการอบรมหลายครั้งได้

**Architecture:** หน้าเว็บ static (HTML/CSS/JS ล้วน) บน GitHub Pages คุยกับ Supabase ตรงผ่าน supabase-js สิทธิ์คุมด้วย RLS; ผู้เข้าอบรมเช็คชื่อผ่านฟังก์ชัน `check_in` (security definer) เท่านั้น; แอดมินล็อกอิน Google

**Tech Stack:** Supabase (Postgres, Auth, Realtime), supabase-js v2 (CDN ESM), `qrcode` (CDN), Lucide (CDN), node:test สำหรับ helper

**Spec:** `docs/superpowers/specs/2026-11-21-training-checkin-lite-design.md`

## Global Constraints
- อีเมลแอดมิน: `chaokoh.ex@gmail.com` (ตัวเดียว)
- ข้อความบนหน้าจอเป็นภาษาไทยทั้งหมด; วันที่แสดงแบบ พ.ศ. (เช่น `21 พ.ย. 2569`), เวลาแบบ `13:05 น.`
- ไม่มี build step; ทุกไลบรารีมาจาก CDN
- ธีมเขียวพาสเทล + ต้นมะพร้าว (เบากว่าตัวเดิม); ไอคอน Lucide
- ผู้เข้าอบรม ≤ 2 แตะ (แตะชื่อ → ยืนยัน)
- mobile-first
- repo `training-checkin-lite` แยกจาก `training-checkin`

## Review Focus
1. เปิดหน้าโดยไม่มี `?t=` หรือรหัสผิด → ข้อความ "ไม่พบการอบรมนี้ กรุณาสแกน QR อีกครั้ง" ไม่ใช่หน้าว่าง
2. สองคนแตะชื่อเดียวกันพร้อมกัน / แตะซ้ำ → ครั้งที่สองได้ "ชื่อนี้เช็คชื่อไปแล้ว" เวลาเดิมไม่ถูกทับ
3. ล็อกอินด้วย Gmail อื่น → "บัญชีนี้ไม่มีสิทธิ์แอดมิน" + ออกจากระบบ และ RLS ปฏิเสธทุกการเขียน
4. วางรายชื่อจาก Excel มีบรรทัดว่าง ช่องว่างหัวท้าย ชื่อซ้ำ → ตัดทิ้ง/รวมเหลือชื่อเดียว
5. CSV เปิดใน Excel ภาษาไทยไม่เพี้ยน (มี BOM) และชื่อที่มี `,` หรือ `"` ไม่ทำให้คอลัมน์เลื่อน

---

## File Structure
```
supabase/schema.sql      ตาราง + RLS + ฟังก์ชัน check_in
js/config.js             SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL
js/lib.js                helper ล้วน (ไม่แตะ DOM/เครือข่าย)
js/db.js                 สร้าง supabase client ตัวเดียว
js/checkin.js            ตรรกะหน้าผู้เข้าอบรม
js/admin.js              ตรรกะหน้าแอดมิน
index.html, admin.html, css/style.css, img/coconut.svg
tests/lib.test.mjs
README.md                วิธีตั้ง Google OAuth + เปิด Pages
```

### Task 1: ฐานข้อมูล Supabase

**Files:** Create `supabase/schema.sql`

**Interfaces — Produces:**
- `trainings(id uuid pk default gen_random_uuid(), title text not null, training_date date not null, created_at timestamptz default now())`
- `attendees(id uuid pk, training_id uuid not null references trainings on delete cascade, name text not null, checked_in_at timestamptz null, unique(training_id, name))`
- `check_in(p_attendee_id uuid) returns jsonb` → `{"ok":true,"checked_in_at":...}` หรือ `{"ok":false,"reason":"already"|"not_found","checked_in_at":...}`; ทำ `update ... set checked_in_at=now() where id=p and checked_in_at is null`; `security definer`, `grant execute to anon, authenticated`
- `is_admin() returns boolean` = `auth.jwt()->>'email' = 'chaokoh.ex@gmail.com'`
- RLS: `anon`/`authenticated` select ทั้งสองตาราง; insert/update/delete เฉพาะ `is_admin()`
- `attendees` อยู่ใน publication `supabase_realtime`

- [ ] **Step 1:** ดู `list_projects`; ถ้าโปรเจกต์ฟรีที่ทำงานอยู่ < 2 สร้างใหม่ชื่อ `training-checkin-lite` (ยืนยันค่าใช้จ่ายกับผู้ใช้ผ่าน `get_cost`/`confirm_cost`); ถ้าเต็ม ใช้โปรเจกต์เดิมและตั้งชื่อตาราง `lite_trainings`/`lite_attendees` (ปรับทุกงานถัดไปตาม)
- [ ] **Step 2:** เขียน `schema.sql` แล้ว `apply_migration` ชื่อ `init_checkin_lite`
- [ ] **Step 3: ตรวจ** ด้วย `execute_sql` (ใน transaction แล้ว rollback):
  - `set local role anon; insert into trainings(...)` → ต้อง error RLS
  - insert training+attendee ด้วย role ปกติ, `set local role anon; select check_in(id)` → `ok:true`; เรียกซ้ำ → `ok:false, reason:'already'`, `checked_in_at` เท่าเดิม
  - `select check_in(gen_random_uuid())` → `reason:'not_found'`
  - `insert` ชื่อซ้ำใน training เดียว → error unique
- [ ] **Step 4:** `get_advisors` (security) ไม่มีคำเตือนระดับ ERROR
- [ ] **Step 5:** commit `feat: supabase schema with RLS and check_in`

### Task 2: helper ล้วน

**Files:** Create `js/lib.js`, `tests/lib.test.mjs`

**Interfaces — Produces (ESM exports):**
- `parseNames(text: string): string[]` — แยกบรรทัด/แท็บแรก, trim, ตัดว่าง, ตัดซ้ำ (คงลำดับแรก)
- `filterByName(list: {name:string}[], q: string): {name}[]` — contains แบบไม่สนตัวพิมพ์และช่องว่างหัวท้าย; `q` ว่าง → ทั้งหมด
- `formatThaiDate(iso: 'YYYY-MM-DD'): string` → `'21 พ.ย. 2569'`
- `formatTime(ts: string|null): string` → `'13:05 น.'` (เวลา Asia/Bangkok) หรือ `''`
- `toCsv(training:{title,training_date}, rows:{name,checked_in_at}[]): string` — BOM `﻿` นำหน้า, หัว `ชื่อ,สถานะ,เวลา`, สถานะ `มา`/`ไม่มา`, escape ตาม RFC 4180
- `sortAttendees(rows)` — ยังไม่มาก่อน (ตามชื่อ `localeCompare(...,'th')`), แล้วมาแล้ว (ตามเวลา)

- [ ] **Step 1: เขียนเทสที่ล้ม** ใน `tests/lib.test.mjs`:
  - `parseNames(' สมชาย \n\nสมหญิง\nสมชาย\r\n')` → `['สมชาย','สมหญิง']`
  - `parseNames('สมชาย\t001\n')` → `['สมชาย']`
  - `filterByName([{name:'สมชาย ใจดี'},{name:'มานี'}], ' ใจดี ')` → 1 ตัว `สมชาย ใจดี`
  - `formatThaiDate('2026-11-21')` → `'21 พ.ย. 2569'`
  - `formatTime('2026-11-21T06:05:00Z')` → `'13:05 น.'`; `formatTime(null)` → `''`
  - `toCsv({title:'ก',training_date:'2026-11-21'}, [{name:'a,"b"',checked_in_at:null}])` เริ่มด้วย `'﻿'` และมีบรรทัด `"a,""b""",ไม่มา,`
- [ ] **Step 2:** `node --test tests/` → FAIL (import ไม่เจอ)
- [ ] **Step 3:** เขียน `js/lib.js` (ใช้ `Intl.DateTimeFormat('th-TH', {timeZone:'Asia/Bangkok', ...})`)
- [ ] **Step 4:** `node --test tests/` → PASS ทั้งหมด
- [ ] **Step 5:** commit `feat: pure helpers with tests`

### Task 3: หน้าผู้เข้าอบรม

**Files:** Create `index.html`, `css/style.css`, `img/coconut.svg`, `js/config.js`, `js/db.js`, `js/checkin.js`

**Interfaces:**
- Consumes: Task 1 tables + `check_in`; Task 2 `filterByName`, `formatThaiDate`, `formatTime`
- Produces: `js/db.js` export `supabase` (client เดียว); `config.js` export `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_EMAIL`; CSS classes ที่ admin ใช้ซ้ำ: `.card`, `.btn`, `.btn-primary`, `.btn-danger`, `.chip-in`, `.chip-out`, `.modal`
- URL: `index.html?t=<training uuid>`

- [ ] **Step 1:** ดึง URL และ anon key ด้วย `get_project_url` / `get_publishable_keys` ใส่ `config.js`
- [ ] **Step 2:** สร้างหน้า: หัวข้อ+วันที่, ช่องค้นหา, รายชื่อ (มาแล้ว = เทา + ✓ กดไม่ได้), modal "ยืนยันว่าคุณคือ {ชื่อ}?" [ใช่][ยกเลิก], หน้าจอสำเร็จ "เช็คชื่อเรียบร้อย ✓ {เวลา}"; ถ้า `check_in` ตอบ `already` → "ชื่อนี้เช็คชื่อไปแล้ว ({เวลา})" แล้วรีเฟรชรายการ; ไม่มี/ผิด `t` → "ไม่พบการอบรมนี้ กรุณาสแกน QR อีกครั้ง"
- [ ] **Step 3: ตรวจ** รัน `python3 -m http.server` แล้วเปิดด้วยเบราว์เซอร์ (มือถือ 390px) กับ training ทดสอบ: เช็คชื่อ 1 คน → สำเร็จ; เปิดอีกแท็บแตะชื่อเดิม → ข้อความ "เช็คชื่อไปแล้ว"; เปิด `index.html` เปล่า → ข้อความไม่พบ; console ไม่มี error
- [ ] **Step 4:** commit `feat: attendee check-in page`

### Task 4: หน้าแอดมิน

**Files:** Create `admin.html`, `js/admin.js`

**Interfaces — Consumes:** `supabase`, `ADMIN_EMAIL`, Task 2 ทุกตัว, CSS classes จาก Task 3

- [ ] **Step 1:** ล็อกอิน: `signInWithOAuth({provider:'google', options:{redirectTo: location.href}})`; หลังล็อกอินถ้า email ≠ `ADMIN_EMAIL` → "บัญชีนี้ไม่มีสิทธิ์แอดมิน" + `signOut()`
- [ ] **Step 2:** รายการการอบรม (ใหม่สุดก่อน) + ยอด มา/ทั้งหมด; ฟอร์มสร้าง (หัวข้อ, วันที่ default วันนี้, textarea รายชื่อ → `parseNames`; แสดง "พบ N ชื่อ" ก่อนกดบันทึก)
- [ ] **Step 3:** หน้ารายละเอียด (`admin.html#<id>`): QR ของ `index.html?t=<id>` (ปุ่มขยายเต็มจอ + พิมพ์), ยอด "มา X / Y", รายการเรียงด้วย `sortAttendees`, realtime subscribe `attendees` filter `training_id=eq.<id>`, ปุ่ม: ดาวน์โหลด CSV (`toCsv`, ชื่อไฟล์ `เช็คชื่อ-{หัวข้อ}-{วันที่}.csv`), เพิ่มชื่อ, ลบชื่อ, ยกเลิกเช็คชื่อ (set `checked_in_at=null`), ลบการอบรม (ยืนยันก่อน)
- [ ] **Step 4: ตรวจ** ในเบราว์เซอร์ (session ที่ล็อกอินแอดมินได้ — ถ้ายังไม่ได้ตั้ง OAuth ให้ทดสอบหลัง Task 5): สร้าง training วางรายชื่อที่มีบรรทัดว่าง/ซ้ำ → จำนวนถูก; เช็คชื่อจากอีกแท็บ → หน้าแอดมินอัปเดตเองภายในไม่กี่วินาที; ยกเลิกเช็คชื่อ → กลับเป็นยังไม่มา; CSV เปิดแล้วไทยไม่เพี้ยน
- [ ] **Step 5:** commit `feat: admin page`

### Task 5: ขึ้นเว็บจริง

**Files:** Create `README.md`

- [ ] **Step 1:** README ภาษาไทย: ขั้นตั้ง Google OAuth Client (Authorized redirect URI = `https://<ref>.supabase.co/auth/v1/callback`), ใส่ Client ID/Secret ใน Supabase → Auth → Providers → Google, ใส่ Site URL/Redirect URLs เป็นที่อยู่ GitHub Pages
- [ ] **Step 2:** สร้าง repo `Chaokoh-ex/training-checkin-lite` (public, จำเป็นสำหรับ Pages ฟรี) แล้ว push; เปิด GitHub Pages จาก branch `main` root
- [ ] **Step 3:** ตั้ง Site URL/Redirect URLs ใน Supabase Auth (ถ้า MCP ทำไม่ได้ ให้ผู้ใช้ทำตาม README)
- [ ] **Step 4:** ผู้ใช้ตั้ง Google OAuth ตาม README
- [ ] **Step 5: ตรวจ** บนเว็บจริง: แอดมินล็อกอินได้, สร้างการอบรม, สแกน QR จากมือถือ, เช็คชื่อ, ยอดขึ้นในหน้าแอดมิน; ลบ training ทดสอบทิ้ง
- [ ] **Step 6:** commit `docs: setup guide`
