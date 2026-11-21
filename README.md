# เช็คชื่ออบรม (ตัวเรียบ)

ผู้เข้าอบรมสแกน QR → แตะชื่อตัวเอง → เสร็จ
แอดมินสร้างการอบรมได้หลายครั้ง แต่ละครั้งมี QR ของตัวเอง

- หน้าผู้เข้าอบรม: `index.html?t=<รหัสการอบรม>` (เปิดจาก QR)
- หน้าแอดมิน: `admin.html` (ล็อกอินด้วยลิงก์ทางอีเมล เฉพาะ `chaokoh.ex@gmail.com`)

## ตั้งค่าครั้งแรก

### 1. ที่อยู่เว็บใน Supabase (จำเป็น เพื่อให้ลิงก์ในอีเมลพากลับมาที่เว็บ)
Supabase → **Authentication → URL Configuration**
- **Site URL:** `https://chaokoh-ex.github.io/training-checkin-lite/admin.html`
- **Redirect URLs:** เพิ่ม `https://chaokoh-ex.github.io/training-checkin-lite/**`

### 2. GitHub Pages
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
