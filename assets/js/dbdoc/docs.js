// ─────────────────────────────────────────────
// DB 산출물 도구 — 산출물(문서) 정의 · 미리보기 · 엑셀 생성
//  문서 모델: { key, title, sheets: [{ name, title, freeze, widths, sections: [{ meta, header, rows }] }] }
//  같은 모델로 화면 미리보기와 엑셀(ExcelJS)을 만들기 때문에 결과가 일치합니다.
// ─────────────────────────────────────────────
import { tablesOf, today } from './util.js';

const typeFull = (r) => (r.len ? `${r.type}(${r.len})` : r.type);

// 컬럼 단위 문서(테이블 정의서·컬럼 정의서)에 쓸 수 있는 항목
export const COLUMN_ITEMS = {
  no: { label: 'No', w: 6, get: (r, i) => i + 1 },
  tbl: { label: '테이블ID', w: 22, get: (r) => r.tbl },
  tblNm: { label: '테이블명', w: 20, get: (r) => r.tblNm },
  col: { label: '컬럼ID', w: 22, get: (r) => r.col },
  colNm: { label: '컬럼명', w: 20, get: (r) => r.colNm },
  typeFull: { label: '데이터타입', w: 18, get: typeFull },
  type: { label: '타입', w: 14, get: (r) => r.type },
  len: { label: '길이', w: 8, get: (r) => r.len },
  nullable: { label: 'NULL', w: 7, get: (r) => (r.nullable === 'N' ? 'N' : 'Y') },
  notNull: { label: 'NOT NULL', w: 9, get: (r) => (r.nullable === 'N' ? 'Y' : '') },
  pk: { label: 'PK', w: 6, get: (r) => (r.pk === 'Y' ? 'Y' : '') },
  fk: { label: 'FK', w: 18, get: (r) => r.fk },
  def: { label: '기본값', w: 14, get: (r) => r.def },
  desc: { label: '설명', w: 36, get: (r) => r.desc },
};

// 테이블 단위 문서(테이블 목록)에 쓸 수 있는 항목
export const TABLE_ITEMS = {
  no: { label: 'No', w: 6, get: (t, i) => i + 1 },
  tbl: { label: '테이블ID', w: 24, get: (t) => t.tbl },
  tblNm: { label: '테이블명', w: 22, get: (t) => t.tblNm },
  colCount: { label: '컬럼수', w: 8, get: (t) => t.rows.length },
  pkCols: { label: 'PK 컬럼', w: 24, get: (t) => t.rows.filter((r) => r.pk === 'Y').map((r) => r.col).join(', ') },
  tblDesc: { label: '테이블설명', w: 40, get: (t) => t.tblDesc },
};

// 테이블 정의서 상단(머리말)에 쓸 수 있는 항목
export const META_ITEMS = {
  project: { label: '프로젝트명', get: (t, c) => c.project.name },
  system: { label: '시스템명', get: (t, c) => c.project.system },
  dbms: { label: 'DBMS', get: (t, c) => c.project.dbms },
  tbl: { label: '테이블ID', get: (t) => t.tbl },
  tblNm: { label: '테이블명', get: (t) => t.tblNm },
  author: { label: '작성자', get: (t, c) => c.project.author },
  date: { label: '작성일', get: (t, c) => c.project.date || today() },
  version: { label: '문서버전', get: (t, c) => c.project.version },
  tblDesc: { label: '테이블설명', get: (t) => t.tblDesc },
};

export const DOC_TYPES = {
  tableList: { label: '테이블 목록', items: TABLE_ITEMS, desc: '전체 테이블을 한 장에 정리 (테이블ID·명·컬럼수·PK)' },
  tableDef: { label: '테이블 정의서', items: COLUMN_ITEMS, desc: '테이블마다 머리말 + 컬럼 목록 블록' },
  columnDef: { label: '컬럼 정의서', items: COLUMN_ITEMS, desc: '전체 컬럼을 한 목록으로 (테이블ID 포함)' },
};

const pick = (items, keys) => [
  ...keys.map((k) => ({ key: k, label: items[k].label, on: true })),
  ...Object.keys(items).filter((k) => !keys.includes(k)).map((k) => ({ key: k, label: items[k].label, on: false })),
];

export function defaultTemplate() {
  return {
    headerColor: '#DCE6F1',
    fileName: '{프로젝트}_DB산출물_{날짜}',
    outputMode: 'single', // single: 한 파일에 시트로 / separate: 문서별 파일
    docs: {
      tableList: { on: true, title: '테이블 목록', columns: pick(TABLE_ITEMS, ['no', 'tbl', 'tblNm', 'colCount', 'pkCols', 'tblDesc']) },
      tableDef: {
        on: true,
        title: '테이블 정의서',
        split: false, // true: 테이블별 시트 분리
        meta: pick(META_ITEMS, ['system', 'author', 'tbl', 'date', 'tblNm', 'version', 'tblDesc']),
        columns: pick(COLUMN_ITEMS, ['no', 'col', 'colNm', 'typeFull', 'nullable', 'pk', 'fk', 'def', 'desc']),
      },
      columnDef: { on: true, title: '컬럼 정의서', columns: pick(COLUMN_ITEMS, ['no', 'tbl', 'tblNm', 'col', 'colNm', 'type', 'len', 'nullable', 'pk', 'fk', 'def', 'desc']) },
    },
  };
}

// 저장된 양식에 새로 추가된 항목이 빠져 있으면 보충
export function upgradeTemplate(tpl) {
  const base = defaultTemplate();
  const out = { ...base, ...tpl, docs: { ...base.docs } };
  Object.keys(base.docs).forEach((dk) => {
    const cur = { ...base.docs[dk], ...(tpl?.docs?.[dk] ?? {}) };
    ['columns', 'meta'].forEach((part) => {
      if (!base.docs[dk][part]) return;
      const have = new Set((cur[part] ?? []).map((c) => c.key));
      const valid = new Set(base.docs[dk][part].map((c) => c.key));
      cur[part] = [...(cur[part] ?? []).filter((c) => valid.has(c.key)), ...base.docs[dk][part].filter((c) => !have.has(c.key)).map((c) => ({ ...c, on: false }))];
    });
    out.docs[dk] = cur;
  });
  return out;
}

// ── 문서 모델 생성 ─────────────────────────────
export function buildDoc(docKey, ctx) {
  const tpl = ctx.template.docs[docKey];
  const items = DOC_TYPES[docKey].items;
  const cols = tpl.columns.filter((c) => c.on);
  const header = cols.map((c) => c.label || items[c.key].label);
  const widths = cols.map((c) => items[c.key].w);
  const tables = tablesOf(ctx.rows);

  if (docKey === 'tableList') {
    return {
      key: docKey, title: tpl.title,
      sheets: [{ name: tpl.title, title: tpl.title, widths, freeze: true, sections: [{ meta: [], header, rows: tables.map((t, i) => cols.map((c) => items[c.key].get(t, i))) }] }],
    };
  }

  if (docKey === 'columnDef') {
    return {
      key: docKey, title: tpl.title,
      sheets: [{ name: tpl.title, title: tpl.title, widths, freeze: true, sections: [{ meta: [], header, rows: ctx.rows.map((r, i) => cols.map((c) => items[c.key].get(r, i))) }] }],
    };
  }

  // tableDef
  const metaDefs = (tpl.meta ?? []).filter((m) => m.on);
  const section = (t) => ({
    meta: metaDefs.map((m) => [m.label || META_ITEMS[m.key].label, String(META_ITEMS[m.key].get(t, ctx) ?? '')]),
    header,
    rows: t.rows.map((r, i) => cols.map((c) => items[c.key].get(r, i))),
  });
  if (tpl.split) {
    return {
      key: docKey, title: tpl.title,
      sheets: tables.map((t) => ({ name: t.tbl, title: `${tpl.title} — ${t.tblNm || t.tbl}`, widths, freeze: false, sections: [section(t)] })),
    };
  }
  return { key: docKey, title: tpl.title, sheets: [{ name: tpl.title, title: tpl.title, widths, freeze: false, sections: tables.map(section) }] };
}

export function buildAll(ctx) {
  return Object.keys(DOC_TYPES).filter((k) => ctx.template.docs[k]?.on).map((k) => buildDoc(k, ctx));
}

// ── 미리보기 HTML ─────────────────────────────
const e = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function metaHtml(meta, n) {
  if (!meta.length) return '';
  const perRow = n >= 4 ? 2 : 1;
  let html = '';
  for (let i = 0; i < meta.length; i += perRow) {
    const pairs = meta.slice(i, i + perRow);
    html += '<tr>';
    pairs.forEach(([k, v]) => { html += `<th>${e(k)}</th><td>${e(v)}</td>`; });
    if (pairs.length < perRow) html += '<th></th><td></td>';
    html += '</tr>';
  }
  return `<table class="doc-meta">${html}</table>`;
}

export function previewHtml(doc, { color = '#DCE6F1', maxSections = 3, maxRows = 40, maxSheets = 3 } = {}) {
  const sheets = doc.sheets.slice(0, maxSheets);
  let html = '';
  if (doc.sheets.length > maxSheets) html += `<p class="muted">시트 ${doc.sheets.length}개 중 ${maxSheets}개만 미리보기</p>`;
  sheets.forEach((s) => {
    html += `<div class="doc-sheet"><div class="doc-sheet-name">시트: ${e(s.name)}</div><h3 class="doc-title">${e(s.title)}</h3>`;
    s.sections.slice(0, maxSections).forEach((sec) => {
      html += '<div class="doc-section">';
      html += metaHtml(sec.meta, sec.header.length);
      html += `<table class="doc-table"><thead><tr>${sec.header.map((h) => `<th style="background:${e(color)}">${e(h)}</th>`).join('')}</tr></thead><tbody>`;
      html += sec.rows.slice(0, maxRows).map((r) => `<tr>${r.map((v) => `<td>${e(v)}</td>`).join('')}</tr>`).join('');
      if (sec.rows.length > maxRows) html += `<tr><td colspan="${sec.header.length}" class="muted">… 외 ${sec.rows.length - maxRows}행</td></tr>`;
      html += '</tbody></table></div>';
    });
    if (s.sections.length > maxSections) html += `<p class="muted">… 외 ${s.sections.length - maxSections}개 테이블 (엑셀에는 모두 포함)</p>`;
    html += '</div>';
  });
  return html;
}

// ── 엑셀 생성 (ExcelJS) ─────────────────────────
const argb = (hex) => `FF${String(hex || '#DCE6F1').replace('#', '').toUpperCase().padEnd(6, '0').slice(0, 6)}`;
const thin = { style: 'thin', color: { argb: 'FF8C96A3' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

function safeSheetName(name, used) {
  let base = String(name || 'Sheet').replace(/[\\/*?:[\]]/g, '_').slice(0, 31) || 'Sheet';
  let n = base; let i = 2;
  while (used.has(n.toUpperCase())) { const suf = `(${i++})`; n = base.slice(0, 31 - suf.length) + suf; }
  used.add(n.toUpperCase());
  return n;
}

function writeSheet(wb, s, used, color) {
  const ws = wb.addWorksheet(safeSheetName(s.name, used));
  const n = Math.max(1, s.widths.length);
  ws.columns = s.widths.map((w) => ({ width: w }));
  let r = 1;

  ws.mergeCells(r, 1, r, n);
  const title = ws.getCell(r, 1);
  title.value = s.title;
  title.font = { bold: true, size: 16 };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(r).height = 30;
  r += 2;

  s.sections.forEach((sec, si) => {
    // 머리말: 열이 4개 이상이면 한 줄에 2쌍(라벨|값|라벨|값)
    const perRow = n >= 4 ? 2 : 1;
    const half = perRow === 2 ? Math.floor(n / 2) : n;
    for (let i = 0; i < sec.meta.length; i += perRow) {
      const pairs = sec.meta.slice(i, i + perRow);
      const spans = perRow === 2 ? [[1, half], [half + 1, n]] : [[1, n]];
      spans.forEach(([from, to], pi) => {
        const [k, v] = pairs[pi] ?? ['', ''];
        const lc = ws.getCell(r, from);
        lc.value = k;
        lc.font = { bold: true };
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        lc.alignment = { vertical: 'middle', horizontal: 'center' };
        if (to > from) {
          if (to > from + 1) ws.mergeCells(r, from + 1, r, to);
          const vc = ws.getCell(r, from + 1);
          vc.value = v;
          vc.alignment = { vertical: 'middle', wrapText: true };
        }
        for (let c = from; c <= to; c += 1) ws.getCell(r, c).border = border;
      });
      r += 1;
    }

    const hr = ws.getRow(r);
    sec.header.forEach((h, i) => {
      const c = hr.getCell(i + 1);
      c.value = h;
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(color) } };
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      c.border = border;
    });
    if (s.freeze && si === 0) ws.views = [{ state: 'frozen', ySplit: r }];
    if (s.freeze && si === 0) ws.autoFilter = { from: { row: r, column: 1 }, to: { row: r, column: n } };
    r += 1;

    sec.rows.forEach((row) => {
      const xr = ws.getRow(r);
      row.forEach((v, i) => {
        const c = xr.getCell(i + 1);
        c.value = typeof v === 'number' ? v : String(v ?? '');
        c.border = border;
        c.alignment = { vertical: 'middle', wrapText: true, horizontal: ['No', 'NULL', 'PK', 'NOT NULL', '컬럼수', '길이'].includes(sec.header[i]) ? 'center' : 'left' };
      });
      r += 1;
    });
    r += 2;
  });
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  return ws;
}

export function applyFileName(pattern, ctx, docTitle = '') {
  const p = ctx.project;
  const d = (p.date || today()).replace(/-/g, '');
  const name = String(pattern || '{프로젝트}_DB산출물_{날짜}')
    .replaceAll('{프로젝트}', p.name || '프로젝트')
    .replaceAll('{시스템}', p.system || '시스템')
    .replaceAll('{날짜}', d)
    .replaceAll('{버전}', `v${ctx.version ?? ''}`)
    .replaceAll('{문서}', docTitle);
  return `${name.replace(/[\\/:*?"<>|]/g, '_')}.xlsx`;
}

export async function docsToBlob(docs, color) {
  if (!window.ExcelJS) throw new Error('엑셀 라이브러리(ExcelJS)를 불러오지 못했습니다. 인터넷 연결을 확인하세요.');
  const wb = new window.ExcelJS.Workbook();
  wb.creator = 'DB 산출물 도구 (초안)';
  wb.created = new Date();
  const used = new Set();
  docs.forEach((d) => d.sheets.forEach((s) => writeSheet(wb, s, used, color)));
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// 업로드용 빈 양식 (헤더 + 예시 3행)
export async function uploadTemplateBlob(fields) {
  if (!window.ExcelJS) throw new Error('엑셀 라이브러리(ExcelJS)를 불러오지 못했습니다.');
  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('컬럼정보');
  ws.columns = fields.map((f) => ({ header: f.label, key: f.key, width: Math.max(10, f.label.length * 2 + 6) }));
  ws.addRows([
    { tbl: 'TB_USER', tblNm: '사용자', tblDesc: '서비스 사용자 정보', col: 'USER_ID', colNm: '사용자ID', type: 'VARCHAR2', len: '20', nullable: 'N', pk: 'Y', fk: '', def: '', desc: '로그인 ID' },
    { tbl: 'TB_USER', tblNm: '사용자', tblDesc: '', col: 'USER_NM', colNm: '사용자명', type: 'VARCHAR2', len: '50', nullable: 'N', pk: '', fk: '', def: '', desc: '' },
    { tbl: 'TB_USER', tblNm: '사용자', tblDesc: '', col: 'REG_DT', colNm: '등록일시', type: 'DATE', len: '', nullable: 'N', pk: '', fk: '', def: 'SYSDATE', desc: '' },
  ]);
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
    c.border = border;
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
