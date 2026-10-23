// ─────────────────────────────────────────────
// DB 산출물 도구 — 컬럼정보 검증 규칙
//  error: 확정 불가 / warn: 확인 권장
// ─────────────────────────────────────────────
import { needsLength } from './fields.js';
import { tablesOf } from './util.js';

const ID_RE = /^[A-Za-z_][A-Za-z0-9_$#]*$/;
const LEN_RE = /^(\d+(,\d+)?|MAX|\*)$/i;

export function validate(rows) {
  const issues = [];
  const add = (level, r, field, msg) => issues.push({ level, id: r?.id, tbl: r?.tbl, col: r?.col, field, msg });

  const seen = new Map();
  rows.forEach((r) => {
    if (!r.tbl) add('error', r, 'tbl', '테이블ID가 비어 있습니다');
    else if (!ID_RE.test(r.tbl)) add('warn', r, 'tbl', `테이블ID 형식 확인: ${r.tbl}`);
    if (!r.col) add('error', r, 'col', '컬럼ID가 비어 있습니다');
    else if (!ID_RE.test(r.col)) add('warn', r, 'col', `컬럼ID 형식 확인: ${r.col}`);
    if (!r.type) add('error', r, 'type', '데이터타입이 비어 있습니다');
    if (r.type && needsLength(r.type) && !r.len) add('warn', r, 'len', `${r.type} 타입은 길이가 필요합니다`);
    if (r.len && !LEN_RE.test(r.len)) add('warn', r, 'len', `길이 형식 확인: ${r.len} (예: 100, 10,2)`);
    if (!r.colNm) add('warn', r, 'colNm', '컬럼명(한글)이 비어 있습니다');
    if (r.pk === 'Y' && r.nullable === 'Y') add('error', r, 'nullable', 'PK 컬럼은 NULL을 허용할 수 없습니다');

    if (r.tbl && r.col) {
      const k = `${r.tbl}.${r.col}`;
      if (seen.has(k)) add('error', r, 'col', `중복 컬럼: ${k}`);
      else seen.set(k, r);
    }
  });

  tablesOf(rows).forEach((t) => {
    if (!t.rows.some((r) => r.pk === 'Y')) add('warn', t.rows[0], 'pk', `${t.tbl}: PK 컬럼이 없습니다`);
    if (!t.tblNm) add('warn', t.rows[0], 'tblNm', `${t.tbl}: 테이블명(한글)이 비어 있습니다`);
    const names = new Set(t.rows.map((r) => r.tblNm).filter(Boolean));
    if (names.size > 1) add('warn', t.rows[0], 'tblNm', `${t.tbl}: 테이블명이 행마다 다릅니다 (${[...names].join(' / ')})`);
  });

  return {
    issues,
    errors: issues.filter((i) => i.level === 'error').length,
    warns: issues.filter((i) => i.level === 'warn').length,
  };
}
