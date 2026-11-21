import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNames, filterByName, formatThaiDate, formatTime, toCsv, sortAttendees } from '../js/lib.js';

test('parseNames trims, drops blanks and duplicates, keeps first order', () => {
  assert.deepEqual(parseNames(' สมชาย \n\nสมหญิง\nสมชาย\r\n'), ['สมชาย', 'สมหญิง']);
});

test('parseNames keeps only the first tab column (pasted from Excel)', () => {
  assert.deepEqual(parseNames('สมชาย\t001\n'), ['สมชาย']);
});

test('parseNames collapses inner repeated spaces so near-duplicates merge', () => {
  assert.deepEqual(parseNames('สมชาย  ใจดี\nสมชาย ใจดี'), ['สมชาย ใจดี']);
});

test('filterByName matches substring ignoring surrounding spaces and case', () => {
  const list = [{ name: 'สมชาย ใจดี' }, { name: 'มานี' }, { name: 'John Doe' }];
  assert.deepEqual(filterByName(list, ' ใจดี '), [{ name: 'สมชาย ใจดี' }]);
  assert.deepEqual(filterByName(list, 'john'), [{ name: 'John Doe' }]);
});

test('filterByName with empty query returns everything', () => {
  const list = [{ name: 'a' }, { name: 'b' }];
  assert.deepEqual(filterByName(list, '  '), list);
});

test('formatThaiDate uses Buddhist year and short Thai month', () => {
  assert.equal(formatThaiDate('2026-11-21'), '21 พ.ย. 2569');
});

test('formatTime shows Bangkok time with น.', () => {
  assert.equal(formatTime('2026-11-21T06:05:00Z'), '13:05 น.');
});

test('formatTime of null is empty', () => {
  assert.equal(formatTime(null), '');
});

test('toCsv starts with BOM and escapes commas and quotes', () => {
  const csv = toCsv({ title: 'ก', training_date: '2026-11-21' }, [{ name: 'a,"b"', checked_in_at: null }]);
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes('ชื่อ,สถานะ,เวลา'));
  assert.ok(csv.split('\r\n').includes('"a,""b""",ไม่มา,'));
});

test('toCsv marks attended rows with มา and time', () => {
  const csv = toCsv({ title: 'ก', training_date: '2026-11-21' }, [{ name: 'x', checked_in_at: '2026-11-21T06:05:00Z' }]);
  assert.ok(csv.split('\r\n').includes('x,มา,13:05 น.'));
});

test('sortAttendees: not-yet first by Thai name, then attended by time', () => {
  const rows = [
    { name: 'ข', checked_in_at: '2026-11-21T06:10:00Z' },
    { name: 'ค', checked_in_at: null },
    { name: 'ก', checked_in_at: '2026-11-21T06:05:00Z' },
    { name: 'ก2', checked_in_at: null },
  ];
  assert.deepEqual(sortAttendees(rows).map(r => r.name), ['ก2', 'ค', 'ก', 'ข']);
});

test('sortAttendees does not mutate input', () => {
  const rows = [{ name: 'ข', checked_in_at: null }, { name: 'ก', checked_in_at: null }];
  sortAttendees(rows);
  assert.equal(rows[0].name, 'ข');
});

import { escapeHtml } from '../js/lib.js';
test('escapeHtml neutralises markup in names', () => {
  assert.equal(escapeHtml(`<img src=x onerror="a">&'`), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
});
