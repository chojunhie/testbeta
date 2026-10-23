// 공통 유틸 (순환 참조 방지용으로 분리)

export function tablesOf(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const k = r.tbl || '(테이블ID 없음)';
    if (!map.has(k)) map.set(k, { tbl: k, tblNm: r.tblNm, tblDesc: r.tblDesc, rows: [] });
    const t = map.get(k);
    if (!t.tblNm && r.tblNm) t.tblNm = r.tblNm;
    if (!t.tblDesc && r.tblDesc) t.tblDesc = r.tblDesc;
    t.rows.push(r);
  });
  return [...map.values()];
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
