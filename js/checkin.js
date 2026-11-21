import { supabase } from './db.js';
import { filterByName, formatThaiDate, formatTime } from './lib.js';

const $ = (id) => document.getElementById(id);
const icons = () => window.lucide?.createIcons();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let training = null;
let selected = null;

function showError(text) {
  $('title').textContent = 'เช็คชื่ออบรม';
  $('error').textContent = text;
  $('error').classList.remove('hidden');
  $('pick').classList.add('hidden');
}

function renderNames() {
  const list = filterByName(training.attendees, $('q').value);
  const ul = $('names');
  ul.replaceChildren();
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'muted center';
    li.textContent = training.attendees.length ? 'ไม่พบชื่อนี้ ลองพิมพ์ใหม่ หรือติดต่อผู้จัด' : 'ยังไม่มีรายชื่อในการอบรมนี้';
    ul.append(li);
    return;
  }
  for (const a of list) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'name-btn';
    const name = document.createElement('span');
    name.textContent = a.name;
    const sp = document.createElement('span');
    sp.className = 'spacer';
    b.append(name, sp);
    if (a.checked_in_at) {
      b.disabled = true;
      const chip = document.createElement('span');
      chip.className = 'chip chip-in';
      chip.innerHTML = '<i data-lucide="check"></i>';
      chip.append(`มาแล้ว ${formatTime(a.checked_in_at)}`);
      b.append(chip);
    } else {
      b.addEventListener('click', () => openConfirm(a));
    }
    li.append(b);
    ul.append(li);
  }
  icons();
}

function openConfirm(a) {
  selected = a;
  $('confirm-text').textContent = `ยืนยันว่าคุณคือ "${a.name}" ใช่ไหม?`;
  $('confirm').classList.remove('hidden');
  $('confirm-yes').disabled = false;
  $('confirm-yes').focus();
}
function closeConfirm() { $('confirm').classList.add('hidden'); selected = null; }

async function load(id) {
  const { data, error } = await supabase.rpc('get_training', { p_training_id: id });
  if (error) { showError('โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'); return false; }
  if (!data) { showError('ไม่พบการอบรมนี้ กรุณาสแกน QR อีกครั้ง'); return false; }
  training = data;
  document.title = `เช็คชื่อ: ${data.title}`;
  $('title').textContent = data.title;
  $('date').textContent = formatThaiDate(data.training_date);
  return true;
}

async function doCheckIn() {
  if (!selected) return;
  const a = selected;
  $('confirm-yes').disabled = true;
  const { data, error } = await supabase.rpc('check_in', { p_attendee_id: a.id });
  closeConfirm();
  if (error) { alertMsg('เช็คชื่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'); return; }
  if (data.ok) {
    $('pick').classList.add('hidden');
    $('done-name').textContent = a.name;
    $('done-time').textContent = `เวลา ${formatTime(data.checked_in_at)}`;
    $('done').classList.remove('hidden');
    icons();
    return;
  }
  alertMsg(data.reason === 'already'
    ? `ชื่อนี้เช็คชื่อไปแล้ว (${formatTime(data.checked_in_at)})`
    : 'ไม่พบชื่อนี้แล้ว รายชื่ออาจถูกแก้ไข กรุณาเลือกใหม่');
  await load(training.id);
  renderNames();
}

function alertMsg(text) {
  $('hint').textContent = text;
  $('hint').className = 'msg';
}

async function main() {
  const id = new URLSearchParams(location.search).get('t') ?? '';
  if (!UUID.test(id)) { showError('ไม่พบการอบรมนี้ กรุณาสแกน QR อีกครั้ง'); return; }
  if (!(await load(id))) return;
  $('pick').classList.remove('hidden');
  renderNames();
  $('q').addEventListener('input', renderNames);
  $('confirm-no').addEventListener('click', closeConfirm);
  $('confirm-yes').addEventListener('click', doCheckIn);
  $('confirm').addEventListener('click', (e) => { if (e.target === $('confirm')) closeConfirm(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeConfirm(); });
}

main();
