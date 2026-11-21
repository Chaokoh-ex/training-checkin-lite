# เช็คชื่ออบรม (ตัวเรียบ)

ผู้เข้าอบรมสแกน QR → แตะชื่อตัวเอง → เสร็จ
แอดมินสร้างการอบรมได้หลายครั้ง แต่ละครั้งมี QR ของตัวเอง

- หน้าผู้เข้าอบรม: `index.html?t=<รหัสการอบรม>` (เปิดจาก QR)
- หน้าแอดมิน: `admin.html` (ล็อกอิน Google เฉพาะ `chaokoh.ex@gmail.com`)

## ตั้งค่าครั้งแรก

### 1. Google OAuth (ทำครั้งเดียว)
1. ไปที่ <https://console.cloud.google.com/apis/credentials>
   - ถ้ามี OAuth Client ของเว็บเช็คชื่อตัวเดิมอยู่แล้ว ใช้ตัวเดิมได้ — แค่เพิ่ม redirect URI ข้อ 3
   - ถ้ายังไม่มี: **Create credentials → OAuth client ID → Web application**
2. (ถ้าระบบถาม) ตั้ง OAuth consent screen แบบ External ใส่ชื่อแอปและอีเมล
3. **Authorized redirect URIs** เพิ่ม:
   `https://rsxtswdhvybmhqgydupg.supabase.co/auth/v1/callback`
4. คัดลอก **Client ID** และ **Client secret**
5. ไปที่ Supabase → โปรเจกต์ `training-checkin-lite` → **Authentication → Sign In / Providers → Google** → เปิด แล้ววาง Client ID / Secret → Save

### 2. ที่อยู่เว็บใน Supabase
Supabase → **Authentication → URL Configuration**
- **Site URL:** `https://chaokoh-ex.github.io/training-checkin-lite/admin.html`
- **Redirect URLs:** เพิ่ม `https://chaokoh-ex.github.io/training-checkin-lite/**`

### 3. GitHub Pages
repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)` → Save

## โครงสร้าง
```
index.html / js/checkin.js   หน้าผู้เข้าอบรม
admin.html / js/admin.js     หน้าแอดมิน
js/lib.js                    ฟังก์ชันช่วย (มีเทส: npm test)
js/config.js                 ที่อยู่ Supabase + อีเมลแอดมิน
supabase/schema.sql          ตาราง สิทธิ์ และฟังก์ชันเช็คชื่อ
```

## ความปลอดภัย
- ผู้เข้าอบรมไม่ต้องล็อกอิน: อ่านได้เฉพาะการอบรมที่รู้รหัส (จาก QR) และเช็คชื่อได้ครั้งเดียวต่อชื่อ
- เพิ่ม/แก้/ลบ ได้เฉพาะบัญชีแอดมิน (คุมในฐานข้อมูลด้วย RLS)
- ใครแตะชื่อแทนกันได้ — ตั้งใจให้เรียบ ไม่มีการยืนยันตัวตน
