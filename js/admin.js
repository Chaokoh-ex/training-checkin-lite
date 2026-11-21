import QRCode from 'https://esm.sh/qrcode@1.5.4';
import { supabase } from './db.js';
import { ADMIN_EMAIL } from './config.js';
import { parseNames, formatThaiDate, formatTime, toCsv, sortAttendees, escapeHtml as esc } from './lib.js';

const $ = (id) => document.getElementById(id);
const view = $('view');
const icons = () => window.lucide?.createIcons();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let channel = null;
let current = null; // { training, attendees }

// ---------- ทั่วไป ----------
function flash(text, isErr = false) {
  const f = $('flash');
  f.textContent = text;
  f.className = isErr ? 'msg err' : 'msg';
  clearTimeout(flash.t);
  flash.t = setTimeout(() => f.classList.add('hidden'), 5000);
}

function ask(text, yesLabel = 'ยืนยัน', danger = false) {
  return new Promise((resolve) => {
    $('modal-text').textContent = text;
    const yes = $('modal-yes');
    yes.textContent = yesLabel;
    yes.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    yes.style.flex = '1';
    $('modal').classList.remove('hidden');
    const done = (v) => { $('modal').classList.add('hidden'); yes.onclick = $('modal-no').onclick = null; resolve(v); };
    yes.onclick = () => done(true);
    $('modal-no').onclick = () => done(false);
  });
}

const checkinUrl = (id) => new URL(`index.html?t=${id}`, location.href).href;
const todayBangkok = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());

function stopRealtime() {
  if (channel) { supabase.removeChannel(channel); channel = null; }
}

// ---------- ล็อกอิน ----------
function renderLogin() {
  $('logout').classList.add('hidden');
  $('who').textContent = '';
  view.innerHTML = `
    <div class="card stack center" style="padding:32px 16px">
      <p>เข้าสู่ระบบด้วยบัญชี Google ของแอดมิน</p>
      <button class="btn btn-primary" id="login"><i data-lucide="log-in"></i>เข้าสู่ระบบด้วย Google</button>
    </div>`;
  $('login').onclick = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname },
  });
  icons();
}

// ---------- รายการการอบรม ----------
async function renderList() {
  stopRealtime();
  view.innerHTML = '<p class="muted">กำลังโหลด...</p>';
  const { data, error } = await supabase
    .from('trainings')
    .select('id,title,training_date,attendees(checked_in_at)')
    .order('training_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) { view.innerHTML = '<div class="msg err">โหลดรายการไม่สำเร็จ</div>'; return; }

  const items = data.map((t) => {
    const total = t.attendees.length;
    const came = t.attendees.filter((a) => a.checked_in_at).length;
    return `<a class="training-item" href="#${t.id}">
      <i data-lucide="calendar-check"></i>
      <div><div style="font-weight:600">${esc(t.title)}</div><div class="muted">${formatThaiDate(t.training_date)}</div></div>
      <span class="spacer"></span>
      <span class="chip ${came === total && total ? 'chip-in' : 'chip-out'}">มา ${came} / ${total}</span>
    </a>`;
  }).join('');

  view.innerHTML = `
    <div class="stack">
      <div class="row"><h2 style="margin:0">การอบรมทั้งหมด</h2><span class="spacer"></span>
        <a class="btn btn-primary" href="#new"><i data-lucide="plus"></i>สร้างการอบรมใหม่</a></div>
      ${items || '<div class="card muted center">ยังไม่มีการอบรม กด "สร้างการอบรมใหม่" เพื่อเริ่ม</div>'}
    </div>`;
  icons();
}

// ---------- สร้างการอบรม ----------
function renderNew() {
  stopRealtime();
  view.innerHTML = `
    <form class="card stack" id="new-form">
      <div class="row"><a class="btn btn-sm" href="#"><i data-lucide="arrow-left"></i>กลับ</a><h2 style="margin:0">สร้างการอบรมใหม่</h2></div>
      <div><label for="f-title">หัวข้อการอบรม</label><input type="text" id="f-title" required maxlength="200"></div>
      <div><label for="f-date">วันที่</label><input type="date" id="f-date" required value="${todayBangkok()}"></div>
      <div><label for="f-names">รายชื่อผู้เข้าอบรม (บรรทัดละ 1 คน — วางจาก Excel ได้)</label>
        <textarea id="f-names" placeholder="สมชาย ใจดี&#10;สมหญิง รักงาน"></textarea>
        <div class="muted" id="f-count">พบ 0 ชื่อ</div></div>
      <button class="btn btn-primary" type="submit" id="f-save"><i data-lucide="save"></i>บันทึก</button>
    </form>`;
  const names = $('f-names');
  names.oninput = () => { $('f-count').textContent = `พบ ${parseNames(names.value).length} ชื่อ (ตัดบรรทัดว่างและชื่อซ้ำแล้ว)`; };
  $('new-form').onsubmit = async (e) => {
    e.preventDefault();
    const title = $('f-title').value.trim();
    const date = $('f-date').value;
    const list = parseNames(names.value);
    if (!title) { flash('กรุณาใส่หัวข้อ', true); return; }
    if (!list.length) { flash('กรุณาใส่รายชื่ออย่างน้อย 1 คน', true); return; }
    $('f-save').disabled = true;
    const { data: t, error } = await supabase.from('trainings').insert({ title, training_date: date }).select('id').single();
    if (error) { flash('บันทึกไม่สำเร็จ', true); $('f-save').disabled = false; return; }
    const { error: e2 } = await supabase.from('attendees').insert(list.map((name) => ({ training_id: t.id, name })));
    if (e2) {
      await supabase.from('trainings').delete().eq('id', t.id);
      flash('บันทึกรายชื่อไม่สำเร็จ', true); $('f-save').disabled = false; return;
    }
    flash(`สร้างการอบรมแล้ว (${list.length} คน)`);
    location.hash = t.id;
  };
  icons();
}

// ---------- รายละเอียด ----------
async function loadDetail(id) {
  const [{ data: training, error: e1 }, { data: attendees, error: e2 }] = await Promise.all([
    supabase.from('trainings').select('*').eq('id', id).maybeSingle(),
    supabase.from('attendees').select('*').eq('training_id', id),
  ]);
  if (e1 || e2) return { error: true };
  return { training, attendees };
}

async function renderDetail(id) {
  stopRealtime();
  view.innerHTML = '<p class="muted">กำลังโหลด...</p>';
  const res = await loadDetail(id);
  if (res.error) { view.innerHTML = '<div class="msg err">โหลดข้อมูลไม่สำเร็จ</div>'; return; }
  if (!res.training) { view.innerHTML = '<div class="msg err">ไม่พบการอบรมนี้</div> <p><a href="#">กลับไปหน้ารายการ</a></p>'; return; }
  current = res;
  drawDetail();

  channel = supabase.channel(`att-${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendees', filter: `training_id=eq.${id}` }, refreshAttendees)
    .subscribe();
}

async function refreshAttendees() {
  if (!current) return;
  const { data, error } = await supabase.from('attendees').select('*').eq('training_id', current.training.id);
  if (!error) { current.attendees = data; drawAttendees(); }
}

function drawDetail() {
  const t = current.training;
  view.innerHTML = `
    <div class="stack">
      <div class="row"><a class="btn btn-sm" href="#"><i data-lucide="arrow-left"></i>กลับ</a></div>
      <div class="card row" style="align-items:flex-start;gap:20px">
        <div style="flex:1;min-width:220px" class="stack">
          <h2 style="margin:0">${esc(t.title)}</h2>
          <div class="muted">${formatThaiDate(t.training_date)}</div>
          <div class="stat" id="d-stat"></div>
          <div class="row">
            <button class="btn btn-sm" id="d-csv"><i data-lucide="download"></i>ดาวน์โหลด CSV</button>
            <button class="btn btn-sm" id="d-copy"><i data-lucide="link"></i>คัดลอกลิงก์</button>
            <button class="btn btn-sm btn-danger" id="d-del"><i data-lucide="trash-2"></i>ลบการอบรม</button>
          </div>
        </div>
        <div class="qr-box">
          <canvas id="d-qr"></canvas>
          <button class="btn btn-sm" id="d-qr-big"><i data-lucide="maximize-2"></i>ขยาย / พิมพ์ QR</button>
        </div>
      </div>
      <div class="card stack">
        <div class="row"><h3 style="margin:0">รายชื่อ</h3><span class="spacer"></span>
          <button class="btn btn-sm" id="d-add-toggle"><i data-lucide="user-plus"></i>เพิ่มชื่อ</button></div>
        <div id="d-add" class="stack hidden">
          <textarea id="d-add-names" style="min-height:90px" placeholder="บรรทัดละ 1 คน"></textarea>
          <div class="row"><button class="btn btn-primary btn-sm" id="d-add-save">เพิ่ม</button></div>
        </div>
        <table class="list-table"><tbody id="d-rows"></tbody></table>
      </div>
    </div>`;

  const url = checkinUrl(t.id);
  QRCode.toCanvas($('d-qr'), url, { width: 440, margin: 1 });
  $('d-qr-big').onclick = () => openQrFull(t, url);
  $('d-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(url); flash('คัดลอกลิงก์แล้ว'); }
    catch { flash(url); }
  };
  $('d-csv').onclick = () => downloadCsv();
  $('d-del').onclick = async () => {
    if (!(await ask(`ลบ "${t.title}" และรายชื่อทั้งหมด? ย้อนกลับไม่ได้`, 'ลบ', true))) return;
    const { error } = await supabase.from('trainings').delete().eq('id', t.id);
    if (error) { flash('ลบไม่สำเร็จ', true); return; }
    flash('ลบการอบรมแล้ว');
    location.hash = '';
  };
  $('d-add-toggle').onclick = () => $('d-add').classList.toggle('hidden');
  $('d-add-save').onclick = addNames;
  drawAttendees();
  icons();
}

function drawAttendees() {
  const rows = sortAttendees(current.attendees);
  const came = rows.filter((r) => r.checked_in_at).length;
  $('d-stat').textContent = `มา ${came} / ${rows.length}`;
  $('d-rows').innerHTML = rows.map((a) => `
    <tr data-id="${a.id}">
      <td>${esc(a.name)}</td>
      <td>${a.checked_in_at
        ? `<span class="chip chip-in"><i data-lucide="check"></i>มา ${formatTime(a.checked_in_at)}</span>`
        : '<span class="chip chip-out">ยังไม่มา</span>'}</td>
      <td class="actions">
        ${a.checked_in_at ? '<button class="btn btn-sm" data-act="undo" title="ยกเลิกการเช็คชื่อ"><i data-lucide="undo-2"></i>ยกเลิก</button>' : ''}
        <button class="btn btn-sm btn-danger" data-act="remove" title="ลบชื่อ" aria-label="ลบชื่อ"><i data-lucide="x"></i></button>
      </td>
    </tr>`).join('') || '<tr><td class="muted">ยังไม่มีรายชื่อ</td></tr>';
  $('d-rows').onclick = onRowAction;
  icons();
}

async function onRowAction(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('tr').dataset.id;
  const a = current.attendees.find((x) => x.id === id);
  if (!a) return;
  if (btn.dataset.act === 'undo') {
    if (!(await ask(`ยกเลิกการเช็คชื่อของ "${a.name}"?`))) return;
    const { error } = await supabase.from('attendees').update({ checked_in_at: null }).eq('id', id);
    if (error) flash('ยกเลิกไม่สำเร็จ', true);
  } else {
    if (!(await ask(`ลบ "${a.name}" ออกจากรายชื่อ?`, 'ลบ', true))) return;
    const { error } = await supabase.from('attendees').delete().eq('id', id);
    if (error) flash('ลบไม่สำเร็จ', true);
  }
  await refreshAttendees();
}

async function addNames() {
  const existing = new Set(current.attendees.map((a) => a.name));
  const list = parseNames($('d-add-names').value).filter((n) => !existing.has(n));
  if (!list.length) { flash('ไม่มีชื่อใหม่ให้เพิ่ม (ว่างหรือซ้ำกับที่มีอยู่)', true); return; }
  const { error } = await supabase.from('attendees').insert(list.map((name) => ({ training_id: current.training.id, name })));
  if (error) { flash('เพิ่มชื่อไม่สำเร็จ', true); return; }
  $('d-add-names').value = '';
  $('d-add').classList.add('hidden');
  flash(`เพิ่มแล้ว ${list.length} คน`);
  await refreshAttendees();
}

function downloadCsv() {
  const t = current.training;
  const csv = toCsv(t, sortAttendees(current.attendees));
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `เช็คชื่อ-${t.title.replace(/[\\/:*?"<>|]/g, '_')}-${t.training_date}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function openQrFull(t, url) {
  $('qr-full-title').textContent = t.title;
  $('qr-full-date').textContent = formatThaiDate(t.training_date);
  QRCode.toCanvas($('qr-full-canvas'), url, { width: 900, margin: 1 });
  $('qr-full').classList.remove('hidden');
}
$('qr-close').onclick = () => $('qr-full').classList.add('hidden');
$('qr-print').onclick = () => window.print();

// ---------- เส้นทาง ----------
function route() {
  const h = location.hash.slice(1);
  if (h === 'new') return renderNew();
  if (UUID.test(h)) return renderDetail(h);
  return renderList();
}

let authed = false;
async function onSession(session) {
  if (!session) { authed = false; stopRealtime(); renderLogin(); return; }
  const email = session.user?.email ?? '';
  if (email.toLowerCase() !== ADMIN_EMAIL) {
    await supabase.auth.signOut();
    renderLogin();
    flash(`บัญชี ${email} ไม่มีสิทธิ์แอดมิน`, true);
    return;
  }
  $('who').textContent = email;
  $('logout').classList.remove('hidden');
  if (!authed) { authed = true; route(); }
}

$('logout').onclick = () => supabase.auth.signOut();
window.addEventListener('hashchange', () => { if (authed) route(); });
supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => onSession(session), 0); });
