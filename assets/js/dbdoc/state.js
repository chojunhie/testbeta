// ─────────────────────────────────────────────
// DB 산출물 도구 — 상태 저장소
//  초안 단계에서는 브라우저 localStorage 에만 저장합니다.
//  (백엔드가 생기면 load/save 를 API 호출로 바꾸면 됩니다.)
// ─────────────────────────────────────────────
import { FIELD_KEYS } from './fields.js';
import { defaultTemplate, upgradeTemplate } from './docs.js';

const KEY = 'dbdoc.v1';

function defaults() {
  return {
    project: { name: '', system: '', dbms: 'Oracle', author: '', version: '1.0', date: '' },
    rows: [],
    seq: 1,
    confirmed: null, // { version, at, hash, rows, project }
    history: [], // [{ version, at, tables, columns, added, removed, changed }]
    template: defaultTemplate(),
    templateSavedAt: null,
    lastGenerated: null, // { at, version, files }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = { ...defaults(), ...JSON.parse(raw) };
    d.project = { ...defaults().project, ...d.project };
    d.template = upgradeTemplate(d.template);
    return d;
  } catch {
    return defaults();
  }
}

export const state = load();

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }

let timer = null;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 불가(시크릿 모드 등) */ }
  }, 150);
  listeners.forEach((fn) => fn());
}

export function replaceState(next) {
  const d = defaults();
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, d, next);
  state.project = { ...d.project, ...(next?.project ?? {}) };
  state.template = upgradeTemplate(state.template);
  save();
}

export function resetAll() { replaceState(defaults()); }

export function newRow(init = {}) {
  const r = { id: state.seq++ };
  FIELD_KEYS.forEach((k) => { r[k] = init[k] ?? ''; });
  if (!r.nullable) r.nullable = 'Y';
  return r;
}

const clean = (rows) => rows.map((r) => FIELD_KEYS.map((k) => r[k] ?? '').join('\u0001')).join('\u0002');
export function rowsHash(rows) {
  const s = clean(rows);
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `${rows.length}-${h >>> 0}`;
}

export const isConfirmedCurrent = () => !!state.confirmed && state.confirmed.hash === rowsHash(state.rows);

// tbl.col 기준 변경 비교
export function diffRows(before = [], after = []) {
  const key = (r) => `${r.tbl}.${r.col}`;
  const a = new Map(before.map((r) => [key(r), r]));
  const b = new Map(after.map((r) => [key(r), r]));
  let added = 0; let removed = 0; let changed = 0;
  b.forEach((r, k) => {
    if (!a.has(k)) added += 1;
    else if (FIELD_KEYS.some((f) => (a.get(k)[f] ?? '') !== (r[f] ?? ''))) changed += 1;
  });
  a.forEach((_, k) => { if (!b.has(k)) removed += 1; });
  return { added, removed, changed };
}

export { tablesOf, today } from './util.js';
