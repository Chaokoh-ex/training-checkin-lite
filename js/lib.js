// helper ล้วน: ไม่แตะ DOM หรือเครือข่าย

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

export function parseNames(text) {
  const seen = new Set();
  const out = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const name = clean(line.split('\t')[0]);
    if (name && !seen.has(name)) { seen.add(name); out.push(name); }
  }
  return out;
}

export function filterByName(list, q) {
  const needle = clean(q).toLowerCase();
  if (!needle) return list;
  return list.filter((r) => r.name.toLowerCase().includes(needle));
}

export function formatThaiDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false });

export function formatTime(ts) {
  if (!ts) return '';
  return `${timeFmt.format(new Date(ts))} น.`;
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(training, rows) {
  const lines = [
    [training.title, formatThaiDate(training.training_date)].map(csvCell).join(','),
    'ชื่อ,สถานะ,เวลา',
    ...rows.map((r) => [r.name, r.checked_in_at ? 'มา' : 'ไม่มา', formatTime(r.checked_in_at)].map(csvCell).join(',')),
  ];
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function sortAttendees(rows) {
  const notYet = rows.filter((r) => !r.checked_in_at).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const came = rows.filter((r) => r.checked_in_at).sort((a, b) => new Date(a.checked_in_at) - new Date(b.checked_in_at));
  return [...notYet, ...came];
}
