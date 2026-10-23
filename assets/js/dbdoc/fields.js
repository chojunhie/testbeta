// ─────────────────────────────────────────────
// DB 산출물 도구 — 컬럼정보 항목 정의
//  - 엑셀 업로드 시 헤더 이름을 aliases 로 자동 매칭합니다.
//  - 사내 엑셀 헤더명이 다르면 aliases 에 추가하세요.
// ─────────────────────────────────────────────

export const FIELDS = [
  { key: 'tbl', label: '테이블ID', req: true, aliases: ['테이블ID', '테이블영문명', '테이블물리명', 'TABLE_NAME', 'TABLE', 'TABLE ID', 'TABLENAME'] },
  { key: 'tblNm', label: '테이블명', aliases: ['테이블명', '테이블한글명', '테이블논리명', 'TABLE_COMMENT', 'TABLE_COMMENTS', '엔티티명'] },
  { key: 'tblDesc', label: '테이블설명', aliases: ['테이블설명', 'TABLE_DESCRIPTION', '테이블비고'] },
  { key: 'col', label: '컬럼ID', req: true, aliases: ['컬럼ID', '컬럼영문명', '컬럼물리명', '속성ID', 'COLUMN_NAME', 'COLUMN', 'COLUMN ID', 'COLUMNNAME'] },
  { key: 'colNm', label: '컬럼명', aliases: ['컬럼명', '컬럼한글명', '컬럼논리명', '속성명', 'COLUMN_COMMENT', 'COLUMN_COMMENTS', 'COMMENT', 'COMMENTS'] },
  { key: 'type', label: '데이터타입', req: true, aliases: ['데이터타입', '데이터 타입', '타입', '자료형', 'TYPE', 'DATA_TYPE', 'DATATYPE'] },
  { key: 'len', label: '길이', aliases: ['길이', '자릿수', 'LENGTH', 'SIZE', 'DATA_LENGTH', 'DATA_PRECISION'] },
  { key: 'nullable', label: 'NULL', aliases: ['NULL', 'NULL여부', 'NULLABLE', 'IS_NULLABLE', '널허용', 'NULL허용'] },
  { key: 'pk', label: 'PK', aliases: ['PK', '기본키', 'PRIMARY KEY', 'PRIMARY_KEY', 'KEY'] },
  { key: 'fk', label: 'FK', aliases: ['FK', '외래키', '참조', 'REFERENCES', 'FK참조'] },
  { key: 'def', label: '기본값', aliases: ['기본값', '디폴트', 'DEFAULT', 'DATA_DEFAULT', 'COLUMN_DEFAULT', 'DEFAULT_VALUE'] },
  { key: 'desc', label: '설명', aliases: ['설명', '비고', 'DESCRIPTION', 'REMARK', 'REMARKS'] },
];

export const FIELD_KEYS = FIELDS.map((f) => f.key);

export const norm = (s) => String(s ?? '').toUpperCase().replace(/[\s_()\-./]/g, '');

const ALIAS_INDEX = new Map();
FIELDS.forEach((f) => f.aliases.forEach((a) => { if (!ALIAS_INDEX.has(norm(a))) ALIAS_INDEX.set(norm(a), f.key); }));

export function fieldForHeader(header) {
  return ALIAS_INDEX.get(norm(header)) ?? null;
}

const CHAR_TYPES = ['CHAR', 'VARCHAR', 'VARCHAR2', 'NCHAR', 'NVARCHAR', 'NVARCHAR2', 'VARBINARY', 'BINARY', 'RAW'];
export const needsLength = (type) => CHAR_TYPES.includes(String(type).toUpperCase());

export function yn(v, { truthy = ['Y', 'YES', 'TRUE', '1', 'O', 'V', '✓', '○', '●', 'PK', 'PRI', 'NULL'] } = {}) {
  const s = norm(v);
  if (!s) return '';
  return truthy.map(norm).includes(s) ? 'Y' : 'N';
}

// 업로드/붙여넣기 한 행을 표준 형태로 정리
export function normalizeRow(raw) {
  const r = {};
  FIELD_KEYS.forEach((k) => { r[k] = String(raw[k] ?? '').trim(); });

  r.tbl = r.tbl.toUpperCase();
  r.col = r.col.toUpperCase();
  r.type = r.type.toUpperCase();

  // "VARCHAR2(100)" / "NUMBER(10,2)" 처럼 타입에 길이가 붙어 있으면 분리
  const m = r.type.match(/^([A-Z0-9_ ]+?)\s*\(\s*([^)]*)\)\s*$/);
  if (m) { r.type = m[1].trim(); r.len = m[2].replace(/\s/g, '') || r.len; }
  r.len = r.len.replace(/\s/g, '');

  // NULL 여부: Y=NULL 허용, N=NOT NULL
  const n = norm(r.nullable);
  if (['NOTNULL', 'N', 'NO', 'X', 'FALSE', '0'].includes(n)) r.nullable = 'N';
  else if (n) r.nullable = 'Y';

  r.pk = yn(r.pk) === 'Y' ? 'Y' : '';
  if (r.pk === 'Y' && !r.nullable) r.nullable = 'N';
  if (!r.nullable) r.nullable = 'Y';
  if (['N', 'NO', '-'].includes(r.fk.toUpperCase())) r.fk = '';
  return r;
}

export const DBMS_LIST = ['Oracle', 'MySQL / MariaDB', 'PostgreSQL', 'MS-SQL', 'Tibero', '기타'];
