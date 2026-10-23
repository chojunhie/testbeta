// ─────────────────────────────────────────────
// DB 산출물 도구 — 엑셀/CSV/붙여넣기 읽기 + 헤더 자동 매핑
//  결과 형태: { sheets: [{ name, headers: [], rows: [[]] }] }
// ─────────────────────────────────────────────
import { FIELDS, fieldForHeader, normalizeRow } from './fields.js';

const isEmptyRow = (r) => !r || r.every((v) => String(v ?? '').trim() === '');

// 앞쪽 10행 중 알려진 헤더명이 가장 많이 나온 행을 헤더로 판단
function toSheet(name, matrix) {
  const rows = matrix.map((r) => (r ?? []).map((v) => String(v ?? '').trim()));
  let best = -1; let bestScore = 1;
  rows.slice(0, 10).forEach((r, i) => {
    const score = new Set(r.map(fieldForHeader).filter(Boolean)).size;
    if (score > bestScore) { best = i; bestScore = score; }
  });
  if (best < 0) best = rows.findIndex((r) => !isEmptyRow(r));
  if (best < 0) return { name, headers: [], rows: [] };
  const width = Math.max(...rows.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => rows[best][i] || `(열 ${i + 1})`);
  return { name, headers, rows: rows.slice(best + 1).filter((r) => !isEmptyRow(r)) };
}

export function parseDelimited(text, delim) {
  const t = text.replace(/^﻿/, '');
  const d = delim ?? (t.split('\n', 1)[0].includes('\t') ? '\t' : ',');
  const out = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < t.length; i += 1) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === d) { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); out.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell.replace(/\r$/, '')); out.push(row); }
  return out;
}

export function parsePasted(text) {
  return { sheets: [toSheet('붙여넣기', parseDelimited(text))] };
}

async function readText(file) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8;
  try { return new TextDecoder('euc-kr').decode(buf); } catch { return utf8; } // 한글 엑셀에서 저장한 CSV
}

export async function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    const text = await readText(file);
    return { sheets: [toSheet(file.name, parseDelimited(text, name.endsWith('.tsv') ? '\t' : undefined))] };
  }
  if (name.endsWith('.xls')) throw new Error('.xls(구버전) 파일은 지원하지 않습니다. 엑셀에서 .xlsx 로 다시 저장해 주세요.');
  if (!window.ExcelJS) throw new Error('엑셀 라이브러리(ExcelJS)를 불러오지 못했습니다. 인터넷 연결을 확인하세요.');

  const wb = new window.ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheets = [];
  wb.eachSheet((ws) => {
    const matrix = [];
    ws.eachRow({ includeEmpty: false }, (row, rn) => {
      const arr = [];
      row.eachCell({ includeEmpty: true }, (cell, cn) => { arr[cn - 1] = cellText(cell); });
      matrix[rn - 1] = arr;
    });
    for (let i = 0; i < matrix.length; i += 1) if (!matrix[i]) matrix[i] = [];
    const s = toSheet(ws.name, matrix);
    if (s.rows.length) sheets.push(s);
  });
  if (!sheets.length) throw new Error('데이터가 있는 시트를 찾지 못했습니다.');
  return { sheets };
}

function cellText(cell) {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return String(v.result ?? '');
    if (v.text) return String(v.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v);
}

// 헤더 → 항목 자동 매핑 { fieldKey: 열 index | -1 }
export function autoMap(headers) {
  const map = {};
  FIELDS.forEach((f) => { map[f.key] = -1; });
  headers.forEach((h, i) => {
    const k = fieldForHeader(h);
    if (k && map[k] === -1) map[k] = i;
  });
  return map;
}

// 매핑 적용 → 표준 행 목록
export function applyMapping(sheet, map, { fillDown = true } = {}) {
  const out = [];
  let prev = {};
  sheet.rows.forEach((r) => {
    const raw = {};
    FIELDS.forEach((f) => { raw[f.key] = map[f.key] >= 0 ? r[map[f.key]] ?? '' : ''; });
    // 테이블 정의서처럼 테이블 정보가 첫 행에만 있는 경우 아래로 채움
    if (fillDown) {
      if (!String(raw.tbl).trim()) { raw.tbl = prev.tbl ?? ''; if (!String(raw.tblNm).trim()) raw.tblNm = prev.tblNm ?? ''; }
      else if (!String(raw.tblNm).trim() && raw.tbl === prev.tbl) raw.tblNm = prev.tblNm ?? '';
    }
    const n = normalizeRow(raw);
    if (!n.col && !n.type) return; // 컬럼이 아닌 행(소계, 빈 줄 등) 제외
    out.push(n);
    prev = n;
  });
  return out;
}
