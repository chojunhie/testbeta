// ─────────────────────────────────────────────
// DB 산출물 도구 — 메인 화면 (좌측 단계 메뉴 + 우측 기능 영역)
//  라우팅: #/home, #/project, #/import, #/edit, #/confirm, #/template, #/generate, #/auto
// ─────────────────────────────────────────────
import { initPage, toast, esc } from '../common.js';
import { MOCK_BASE_URL } from '../config.js';
import { FIELDS, DBMS_LIST, normalizeRow } from './fields.js';
import { state, save, newRow, rowsHash, isConfirmedCurrent, diffRows, tablesOf, today, replaceState, resetAll } from './state.js';
import { parseFile, parsePasted, autoMap, applyMapping } from './importer.js';
import { validate } from './validate.js';
import { DOC_TYPES, META_ITEMS, defaultTemplate, upgradeTemplate, buildDoc, buildAll, previewHtml, docsToBlob, downloadBlob, applyFileName, uploadTemplateBlob } from './docs.js';

initPage('dbdoc', { apiLog: false });

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const side = $('#side');
const view = $('#view');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '-');

// ── 검증 결과 캐시 ─────────────────────────────
let vCache = { hash: null, result: null };
function v() {
  const h = rowsHash(state.rows);
  if (vCache.hash !== h) vCache = { hash: h, result: validate(state.rows) };
  return vCache.result;
}

// ── 단계 정의 ────────────────────────────────
const STEPS = [
  { key: 'home', no: '', title: '개요', sub: '전체 흐름 · 진행 현황', render: renderHome },
  { key: 'project', no: 1, title: '프로젝트 정보', sub: '산출물 머리말 정보', render: renderProject },
  { key: 'import', no: 2, title: '컬럼정보 가져오기', sub: '엑셀 업로드 · 붙여넣기', render: renderImport },
  { key: 'edit', no: 3, title: '검토 · 수정', sub: '직접 입력 · 자동 검증', render: renderEdit },
  { key: 'confirm', no: 4, title: '확정', sub: '버전 확정 · 변경 이력', render: renderConfirm },
  { key: 'template', no: 5, title: '산출물 양식', sub: '문서별 항목 · 순서 · 제목', render: renderTemplate },
  { key: 'generate', no: 6, title: '산출물 생성', sub: '미리보기 · 엑셀 다운로드', render: renderGenerate },
  { key: 'auto', no: 7, title: 'DB 자동 생성', sub: 'DB 연결 → 원클릭 생성', render: renderAuto, plan: true },
];

function status(key) {
  const rows = state.rows.length;
  switch (key) {
    case 'project': return state.project.name ? ['done', '입력됨'] : ['todo', '미입력'];
    case 'import': return rows ? ['done', `${rows}건`] : ['todo', '데이터 없음'];
    case 'edit': if (!rows) return ['todo', '-']; return v().errors ? ['warn', `오류 ${v().errors}`] : ['done', v().warns ? `경고 ${v().warns}` : '이상 없음'];
    case 'confirm': if (isConfirmedCurrent()) return ['done', `v${state.confirmed.version}`]; return state.confirmed ? ['warn', '변경됨·재확정'] : ['todo', '미확정'];
    case 'template': return state.templateSavedAt ? ['done', '사용자 양식'] : ['todo', '기본 양식'];
    case 'generate': return state.lastGenerated && state.lastGenerated.version === state.confirmed?.version ? ['done', '생성됨'] : ['todo', '-'];
    case 'auto': return ['plan', '목업'];
    default: return ['', ''];
  }
}

const currentKey = () => {
  const k = location.hash.replace(/^#\/?/, '');
  return STEPS.some((s) => s.key === k) ? k : 'home';
};
const go = (key) => { if (currentKey() === key) route(); else location.hash = `#/${key}`; };

function renderSide() {
  const cur = currentKey();
  const doneCount = STEPS.filter((s) => s.no && !s.plan && status(s.key)[0] === 'done').length;
  side.innerHTML = `
    <div class="dd-side-head">
      <div class="dd-side-title">DB 산출물 자동화</div>
      <div class="dd-progress"><span style="width:${(doneCount / 6) * 100}%"></span></div>
      <div class="muted">${doneCount} / 6 단계 완료</div>
    </div>
    <ol class="dd-steps">
      ${STEPS.map((s) => {
    const [st, text] = status(s.key);
    return `<li><a href="#/${s.key}" class="dd-step ${s.key === cur ? 'active' : ''} ${st}">
          <span class="dd-num">${s.no === '' ? '◎' : st === 'done' ? '✓' : s.no}</span>
          <span class="dd-step-body"><b>${esc(s.title)}</b><small>${esc(s.sub)}</small></span>
          ${text ? `<span class="tag ${st === 'done' ? 'ok' : st === 'warn' ? 'warn' : st === 'plan' ? '' : ''}">${esc(text)}</span>` : ''}
        </a></li>`;
  }).join('')}
    </ol>`;
}

function stepNav(key) {
  const i = STEPS.findIndex((s) => s.key === key);
  const prev = STEPS[i - 1]; const next = STEPS[i + 1];
  return `<div class="dd-nav">
    ${prev ? `<a class="btn" href="#/${prev.key}">← ${esc(prev.title)}</a>` : '<span></span>'}
    ${next ? `<a class="btn primary" href="#/${next.key}">${esc(next.no ? `${next.no}. ` : '')}${esc(next.title)} →</a>` : ''}
  </div>`;
}

function route() {
  const key = currentKey();
  const step = STEPS.find((s) => s.key === key);
  renderSide();
  view.innerHTML = '';
  step.render(view);
  view.insertAdjacentHTML('beforeend', stepNav(key));
  view.scrollTop = 0;
  window.scrollTo(0, 0);
}

const head = (s, extra = '') => `<div class="dd-head">
  <div><div class="dd-eyebrow">${s.no ? `STEP ${s.no}` : 'OVERVIEW'}${s.plan ? ' · 향후 기능 (목업)' : ''}</div><h1>${esc(s.title)}</h1></div>${extra}</div>`;
const stepOf = (k) => STEPS.find((s) => s.key === k);

// ═════════════════════════════════════════════
// 개요
// ═════════════════════════════════════════════
function renderHome(el) {
  const tables = tablesOf(state.rows).length;
  el.innerHTML = `${head(stepOf('home'))}
  <p class="desc">DB 컬럼정보(엑셀)를 올리거나 직접 입력해 확정하면, 지정한 양식에 맞춰 <b>테이블 목록 · 테이블 정의서 · 컬럼 정의서</b>를 엑셀로 만들어 줍니다.
  최종적으로는 연결된 DB에서 컬럼정보를 자동 추출해 단계만 눌러 산출물을 만드는 것이 목표입니다.</p>

  <div class="dd-stats">
    <div class="dd-stat"><span>테이블</span><b>${tables}</b></div>
    <div class="dd-stat"><span>컬럼</span><b>${state.rows.length}</b></div>
    <div class="dd-stat"><span>확정 버전</span><b>${state.confirmed ? `v${state.confirmed.version}` : '-'}</b><small>${state.confirmed ? fmt(state.confirmed.at) : ''}${state.confirmed && !isConfirmedCurrent() ? ' · 이후 변경됨' : ''}</small></div>
    <div class="dd-stat"><span>마지막 산출물</span><b>${state.lastGenerated ? `v${state.lastGenerated.version}` : '-'}</b><small>${state.lastGenerated ? fmt(state.lastGenerated.at) : ''}</small></div>
  </div>

  <h2 class="dd-h2">작업 흐름</h2>
  <div class="dd-flow">
    ${STEPS.filter((s) => s.no).map((s) => {
    const [st, text] = status(s.key);
    return `<a class="dd-flow-card ${st}" href="#/${s.key}">
        <div class="dd-flow-top"><span class="dd-num">${st === 'done' ? '✓' : s.no}</span><span class="tag ${st === 'done' ? 'ok' : st === 'warn' ? 'warn' : ''}">${esc(text)}</span></div>
        <b>${esc(s.title)}</b><small>${esc(s.sub)}</small></a>`;
  }).join('')}
  </div>

  <div class="cols" style="margin-top:20px">
    <section class="card">
      <h2>단계별 구축 계획</h2>
      <ol class="dd-roadmap">
        <li class="now"><b>1차 (현재 초안)</b> 엑셀 업로드·직접 입력 → 검증 → 확정 → 기본 양식으로 엑셀 산출물 생성</li>
        <li><b>2차</b> 사내 산출물 엑셀 양식(.xlsx)을 업로드해 그 서식 그대로 채우기, 양식 팀 공유</li>
        <li><b>3차</b> 백엔드 API로 DB 연결 → 메타데이터(테이블·컬럼·주석·PK/FK) 자동 추출</li>
        <li><b>4차</b> 원클릭 파이프라인(추출→검증→확정→생성) + 이전 버전과 변경 비교표</li>
      </ol>
    </section>
    <section class="card">
      <h2>데이터 보관</h2>
      <p>초안 단계라 작업 내용은 <b>이 브라우저에만</b> 저장됩니다. 다른 PC나 팀원과 주고받을 때는 백업 파일을 사용하세요.</p>
      <div class="toolbar" style="margin-top:12px">
        <button class="btn" id="bkExport">백업 내보내기 (.json)</button>
        <label class="btn">백업 가져오기<input type="file" id="bkImport" accept=".json" hidden></label>
        <button class="btn danger" id="bkReset">전체 초기화</button>
      </div>
    </section>
  </div>`;

  $('#bkExport', el).onclick = () => {
    const blob = new Blob([JSON.stringify({ app: 'dbdoc', savedAt: new Date().toISOString(), data: state }, null, 1)], { type: 'application/json' });
    downloadBlob(blob, `dbdoc_backup_${today().replace(/-/g, '')}.json`);
  };
  $('#bkImport', el).onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.app !== 'dbdoc' || !j.data) throw new Error('DB 산출물 도구 백업 파일이 아닙니다');
      replaceState(j.data); toast('백업을 불러왔습니다', 'success'); route();
    } catch (err) { toast(err.message, 'error'); }
  };
  $('#bkReset', el).onclick = () => {
    if (!confirm('입력한 컬럼정보·확정 이력·양식 설정을 모두 지웁니다. 계속할까요?')) return;
    resetAll(); toast('초기화했습니다'); route();
  };
}

// ═════════════════════════════════════════════
// 1. 프로젝트 정보
// ═════════════════════════════════════════════
function renderProject(el) {
  const p = state.project;
  const f = (k, label, attrs = '') => `<label class="field">${label}<input data-k="${k}" value="${esc(p[k])}" ${attrs}></label>`;
  el.innerHTML = `${head(stepOf('project'))}
  <p class="desc">산출물 머리말(시스템명·작성자·작성일 등)과 파일명에 들어가는 정보입니다. 입력하면 바로 저장됩니다.</p>
  <section class="card dd-form">
    ${f('name', '프로젝트명 *', 'placeholder="예: 차세대 주문관리 구축"')}
    ${f('system', '시스템명', 'placeholder="예: 주문관리시스템(OMS)"')}
    <label class="field">DBMS<select data-k="dbms">${DBMS_LIST.map((d) => `<option ${d === p.dbms ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
    ${f('author', '작성자', 'placeholder="예: 홍길동"')}
    ${f('version', '문서 버전', 'placeholder="1.0"')}
    <label class="field">작성일<input type="date" data-k="date" value="${esc(p.date || today())}"></label>
  </section>`;
  $$('[data-k]', el).forEach((inp) => {
    inp.addEventListener('input', () => { p[inp.dataset.k] = inp.value.trim(); save(); renderSide(); });
  });
}

// ═════════════════════════════════════════════
// 2. 컬럼정보 가져오기
// ═════════════════════════════════════════════
let importTab = 'upload';
let draft = null; // { source, sheets, sheetIdx, map, fillDown }

async function loadMockSheet() {
  const res = await fetch(`${MOCK_BASE_URL}db-columns.json`);
  if (!res.ok) throw new Error('mock/db-columns.json 을 불러오지 못했습니다');
  const arr = await res.json();
  const headers = Object.keys(arr[0] ?? {});
  return { name: 'DB 메타데이터 (목업)', headers, rows: arr.map((o) => headers.map((h) => String(o[h] ?? ''))) };
}

function setDraft(source, sheets) {
  draft = { source, sheets, sheetIdx: 0, map: autoMap(sheets[0].headers), fillDown: true };
}

function renderImport(el) {
  el.innerHTML = `${head(stepOf('import'))}
  <p class="desc">컬럼정보를 가져오면 헤더 이름을 보고 항목을 자동으로 맞춥니다. 맞지 않는 항목만 직접 고르면 됩니다.</p>
  <div class="seg" id="impTabs">
    <button data-t="upload">엑셀 / CSV 업로드</button>
    <button data-t="paste">엑셀에서 복사·붙여넣기</button>
    <button data-t="sample">샘플 데이터</button>
  </div>
  <section class="card" id="impBody"></section>
  <div id="mapBox"></div>`;

  const body = $('#impBody', el);
  const showTab = () => {
    $$('#impTabs button', el).forEach((b) => b.classList.toggle('on', b.dataset.t === importTab));
    if (importTab === 'upload') {
      body.innerHTML = `
        <label class="dropzone" id="drop">
          <input type="file" id="file" accept=".xlsx,.csv,.tsv,.txt" hidden>
          <b>파일을 여기로 끌어오거나 클릭해서 선택</b>
          <span class="muted">.xlsx · .csv · .tsv — 시트가 여러 개면 다음 화면에서 고릅니다</span>
        </label>
        <div class="toolbar" style="margin:12px 0 0">
          <button class="btn" id="tplDown">업로드 양식 받기 (.xlsx)</button>
          <span class="muted">헤더 예: 테이블ID, 테이블명, 컬럼ID, 컬럼명, 데이터타입, 길이, NULL, PK, FK, 기본값, 설명</span>
        </div>`;
      const handle = async (file) => {
        if (!file) return;
        try {
          body.querySelector('#drop b').innerHTML = '<span class="spinner"></span>읽는 중…';
          setDraft(file.name, (await parseFile(file)).sheets);
          renderMapping();
        } catch (err) { toast(err.message, 'error'); } finally { showTab(); }
      };
      $('#file', body).onchange = (e) => handle(e.target.files[0]);
      const drop = $('#drop', body);
      drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); handle(e.dataTransfer.files[0]); };
      $('#tplDown', body).onclick = async () => {
        try { downloadBlob(await uploadTemplateBlob(FIELDS), 'DB컬럼정보_업로드양식.xlsx'); } catch (err) { toast(err.message, 'error'); }
      };
    } else if (importTab === 'paste') {
      body.innerHTML = `
        <label class="field">엑셀에서 헤더 행을 포함해 범위를 복사(Ctrl+C)한 뒤 아래에 붙여넣기(Ctrl+V)
          <textarea id="pasteBox" rows="8" placeholder="테이블ID	테이블명	컬럼ID	컬럼명	데이터타입	길이	NULL	PK&#10;TB_USER	사용자	USER_ID	사용자ID	VARCHAR2	20	N	Y"></textarea>
        </label>
        <button class="btn primary" id="pasteGo">인식하기</button>`;
      $('#pasteGo', body).onclick = () => {
        const t = $('#pasteBox', body).value;
        if (!t.trim()) { toast('붙여넣은 내용이 없습니다', 'error'); return; }
        const parsed = parsePasted(t);
        if (!parsed.sheets[0].rows.length) { toast('데이터 행을 찾지 못했습니다 (헤더 행 포함 필요)', 'error'); return; }
        setDraft('붙여넣기', parsed.sheets); renderMapping();
      };
    } else {
      body.innerHTML = `
        <p>예시 스키마(사용자·상품·주문·주문상품·공통코드, 5개 테이블 30개 컬럼)를 불러와 전체 흐름을 바로 확인해 볼 수 있습니다.
        DB 메타데이터 조회 결과와 같은 헤더(TABLE_NAME, COLUMN_NAME …)라 자동 매핑도 함께 확인됩니다.</p>
        <button class="btn primary" id="sampleGo" style="margin-top:12px">샘플 불러오기</button>`;
      $('#sampleGo', body).onclick = async () => {
        try { setDraft('샘플', [await loadMockSheet()]); renderMapping(); } catch (err) { toast(err.message, 'error'); }
      };
    }
  };
  $$('#impTabs button', el).forEach((b) => { b.onclick = () => { importTab = b.dataset.t; showTab(); }; });
  showTab();
  renderMapping();

  function renderMapping() {
    const box = $('#mapBox', el);
    if (!draft) { box.innerHTML = ''; return; }
    const sheet = draft.sheets[draft.sheetIdx];
    const mapped = applyMapping(sheet, draft.map, { fillDown: draft.fillDown });
    const firstVal = (i) => (i < 0 ? '' : sheet.rows.find((r) => String(r[i] ?? '').trim())?.[i] ?? '');
    const missing = FIELDS.filter((f) => f.req && draft.map[f.key] < 0);
    box.innerHTML = `
      <section class="card" style="margin-top:16px">
        <div class="dd-card-head">
          <h2>항목 매핑 <span class="muted">· ${esc(draft.source)}</span></h2>
          ${draft.sheets.length > 1 ? `<label class="inline">시트 <select id="sheetSel">${draft.sheets.map((s, i) => `<option value="${i}" ${i === draft.sheetIdx ? 'selected' : ''}>${esc(s.name)} (${s.rows.length}행)</option>`).join('')}</select></label>` : ''}
        </div>
        <div class="dd-map">
          ${FIELDS.map((f) => `<div class="dd-map-row ${draft.map[f.key] < 0 ? (f.req ? 'miss' : 'none') : ''}">
            <span>${esc(f.label)}${f.req ? ' <em>*</em>' : ''}</span>
            <select data-f="${f.key}"><option value="-1">— 사용 안 함 —</option>${sheet.headers.map((h, i) => `<option value="${i}" ${draft.map[f.key] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select>
            <code class="muted">${esc(firstVal(draft.map[f.key]))}</code>
          </div>`).join('')}
        </div>
        <label class="inline" style="margin-top:10px"><input type="checkbox" id="fillDown" ${draft.fillDown ? 'checked' : ''}> 테이블ID가 빈 행은 위 행의 테이블로 채우기 (셀 병합된 정의서 대응)</label>
      </section>
      <section class="card" style="margin-top:16px">
        <div class="dd-card-head"><h2>가져올 데이터 미리보기 <span class="muted">· ${mapped.length}개 컬럼 / ${tablesOf(mapped).length}개 테이블 인식</span></h2></div>
        ${missing.length ? `<p class="hint">필수 항목 매핑 필요: ${missing.map((f) => f.label).join(', ')}</p>` : ''}
        <div class="table-wrap"><table class="dd-preview">
          <thead><tr>${FIELDS.map((f) => `<th>${esc(f.label)}</th>`).join('')}</tr></thead>
          <tbody>${mapped.slice(0, 8).map((r) => `<tr>${FIELDS.map((f) => `<td>${esc(r[f.key])}</td>`).join('')}</tr>`).join('')}
          ${mapped.length > 8 ? `<tr><td colspan="${FIELDS.length}" class="muted">… 외 ${mapped.length - 8}행</td></tr>` : ''}</tbody>
        </table></div>
        <div class="toolbar" style="margin:14px 0 0">
          ${state.rows.length
    ? `<button class="btn primary" data-apply="replace" ${missing.length ? 'disabled' : ''}>기존 ${state.rows.length}건을 대체</button>
               <button class="btn" data-apply="append" ${missing.length ? 'disabled' : ''}>기존 데이터에 추가</button>`
    : `<button class="btn primary" data-apply="replace" ${missing.length ? 'disabled' : ''}>가져오기 → 검토·수정</button>`}
          <button class="btn" id="mapCancel">취소</button>
        </div>
      </section>`;
    $('#sheetSel', box)?.addEventListener('change', (e) => { draft.sheetIdx = Number(e.target.value); draft.map = autoMap(draft.sheets[draft.sheetIdx].headers); renderMapping(); });
    $$('[data-f]', box).forEach((s) => { s.onchange = () => { draft.map[s.dataset.f] = Number(s.value); renderMapping(); }; });
    $('#fillDown', box).onchange = (e) => { draft.fillDown = e.target.checked; renderMapping(); };
    $('#mapCancel', box).onclick = () => { draft = null; renderMapping(); };
    $$('[data-apply]', box).forEach((b) => {
      b.onclick = () => {
        const rows = mapped.map((r) => newRow(r));
        state.rows = b.dataset.apply === 'append' ? [...state.rows, ...rows] : rows;
        save(); draft = null;
        toast(`${rows.length}개 컬럼을 가져왔습니다`, 'success');
        go('edit');
      };
    });
  }
}

// ═════════════════════════════════════════════
// 3. 검토 · 수정
// ═════════════════════════════════════════════
let editTab = 'cols';
let editFilter = { tbl: '', q: '' };

const GRID = [
  { k: 'tbl', label: '테이블ID', w: 150 },
  { k: 'tblNm', label: '테이블명', w: 120 },
  { k: 'col', label: '컬럼ID', w: 150 },
  { k: 'colNm', label: '컬럼명', w: 130 },
  { k: 'type', label: '데이터타입', w: 110 },
  { k: 'len', label: '길이', w: 64 },
  { k: 'nullable', label: 'NULL', w: 62, kind: 'yn' },
  { k: 'pk', label: 'PK', w: 40, kind: 'check' },
  { k: 'fk', label: 'FK', w: 150 },
  { k: 'def', label: '기본값', w: 100 },
  { k: 'desc', label: '설명', w: 200 },
];

function renderEdit(el) {
  el.innerHTML = `${head(stepOf('edit'), `<div class="toolbar" style="margin:0"><button class="btn" id="addRow">+ 행 추가</button><button class="btn danger" id="clearAll">전체 삭제</button></div>`)}
  <p class="desc">셀을 직접 고치면 바로 저장되고 자동으로 검증됩니다. <b>오류</b>가 없어야 확정할 수 있고, <b>경고</b>는 확인 권장입니다.</p>
  <div class="dd-issues" id="issues"></div>
  <div class="seg" id="editTabs"><button data-t="cols">컬럼 목록</button><button data-t="tables">테이블 목록</button></div>
  <section class="card" id="editBody" style="padding:12px"></section>`;

  $('#addRow', el).onclick = () => {
    const base = editFilter.tbl ? state.rows.find((r) => r.tbl === editFilter.tbl) : null;
    const r = newRow({ tbl: editFilter.tbl, tblNm: base?.tblNm ?? '' });
    state.rows.push(r); save();
    editTab = 'cols'; editFilter.q = '';
    drawBody();
    const inp = $(`[data-id="${r.id}"][data-k="${editFilter.tbl ? 'col' : 'tbl'}"]`, el);
    inp?.scrollIntoView({ block: 'center' }); inp?.focus();
  };
  $('#clearAll', el).onclick = () => {
    if (!state.rows.length || !confirm(`${state.rows.length}건을 모두 삭제할까요? (확정된 버전은 그대로 남습니다)`)) return;
    state.rows = []; save(); route();
  };
  $$('#editTabs button', el).forEach((b) => { b.onclick = () => { editTab = b.dataset.t; drawBody(); }; });

  let vt = null;
  const revalidate = () => { clearTimeout(vt); vt = setTimeout(() => { drawIssues(); markCells(); renderSide(); }, 250); };

  function drawIssues() {
    const box = $('#issues', el);
    if (!state.rows.length) { box.innerHTML = `<div class="state">컬럼정보가 없습니다. <a href="#/import">2단계에서 가져오거나</a> [+ 행 추가]로 직접 입력하세요.</div>`; return; }
    const r = v();
    box.innerHTML = `
      <div class="dd-issue-sum ${r.errors ? 'fail' : r.warns ? 'warn' : 'ok'}">
        ${r.errors ? `오류 ${r.errors}건` : '오류 없음'} · 경고 ${r.warns}건
        <span class="muted">— 테이블 ${tablesOf(state.rows).length}개 / 컬럼 ${state.rows.length}개</span>
      </div>
      ${r.issues.length ? `<details ${r.errors ? 'open' : ''}><summary>검증 결과 보기</summary><ul>
        ${r.issues.slice(0, 80).map((i) => `<li data-goto="${i.id ?? ''}" data-tbl="${esc(i.tbl ?? '')}"><span class="tag ${i.level === 'error' ? 'fail' : 'warn'}">${i.level === 'error' ? '오류' : '경고'}</span> ${esc(i.msg)} ${i.col ? `<code>${esc(i.tbl)}.${esc(i.col)}</code>` : ''}</li>`).join('')}
        ${r.issues.length > 80 ? `<li class="muted">… 외 ${r.issues.length - 80}건</li>` : ''}
      </ul></details>` : ''}`;
    $$('[data-goto]', box).forEach((li) => {
      li.onclick = () => {
        editTab = 'cols'; editFilter = { tbl: li.dataset.tbl, q: '' }; drawBody();
        const inp = $(`[data-id="${li.dataset.goto}"]`, el);
        inp?.scrollIntoView({ block: 'center' }); inp?.focus();
      };
    });
  }

  function markCells() {
    $$('#editBody [data-id]', el).forEach((i) => i.classList.remove('bad', 'warnc'));
    v().issues.forEach((i) => {
      const inp = $(`#editBody [data-id="${i.id}"][data-k="${i.field}"]`, el);
      if (inp && !inp.classList.contains('bad')) inp.classList.add(i.level === 'error' ? 'bad' : 'warnc');
    });
  }

  function drawBody() {
    $$('#editTabs button', el).forEach((b) => b.classList.toggle('on', b.dataset.t === editTab));
    const body = $('#editBody', el);
    const tables = tablesOf(state.rows);
    if (editTab === 'tables') {
      body.innerHTML = `<p class="muted" style="margin:4px 4px 10px">테이블ID·테이블명·설명을 바꾸면 해당 테이블의 모든 컬럼 행에 반영됩니다.</p>
      <div class="table-wrap"><table class="dd-grid"><thead><tr><th>#</th><th>테이블ID</th><th>테이블명</th><th>테이블설명</th><th>컬럼수</th><th>PK</th><th></th></tr></thead><tbody>
      ${tables.map((t, i) => `<tr><td class="muted">${i + 1}</td>
        <td><input data-t="${esc(t.tbl)}" data-tk="tbl" value="${esc(t.tbl)}" style="width:170px"></td>
        <td><input data-t="${esc(t.tbl)}" data-tk="tblNm" value="${esc(t.tblNm)}" style="width:160px"></td>
        <td><input data-t="${esc(t.tbl)}" data-tk="tblDesc" value="${esc(t.tblDesc)}" style="width:300px"></td>
        <td>${t.rows.length}</td><td class="muted">${esc(t.rows.filter((r) => r.pk === 'Y').map((r) => r.col).join(', '))}</td>
        <td><button class="btn sm" data-view="${esc(t.tbl)}">컬럼 보기</button></td></tr>`).join('')}
      </tbody></table></div>`;
      $$('[data-tk]', body).forEach((inp) => {
        inp.addEventListener('change', () => {
          const k = inp.dataset.tk; let val = inp.value.trim();
          if (k === 'tbl') val = val.toUpperCase();
          const target = state.rows.filter((r) => (r.tbl || '(테이블ID 없음)') === inp.dataset.t);
          target.forEach((r, i) => { r[k] = k === 'tblDesc' && i > 0 ? '' : val; });
          if (k === 'tblDesc' && target[0]) target[0].tblDesc = val;
          save(); drawBody(); revalidate();
        });
      });
      $$('[data-view]', body).forEach((b) => { b.onclick = () => { editTab = 'cols'; editFilter = { tbl: b.dataset.view, q: '' }; drawBody(); }; });
      return;
    }

    const q = editFilter.q.toUpperCase();
    const list = state.rows.filter((r) => (!editFilter.tbl || r.tbl === editFilter.tbl)
      && (!q || [r.tbl, r.tblNm, r.col, r.colNm, r.desc].some((x) => String(x).toUpperCase().includes(q))));
    body.innerHTML = `
      <div class="toolbar">
        <select id="fTbl" style="width:auto"><option value="">전체 테이블 (${tables.length})</option>${tables.map((t) => `<option value="${esc(t.tbl)}" ${t.tbl === editFilter.tbl ? 'selected' : ''}>${esc(t.tbl)} ${t.tblNm ? `· ${esc(t.tblNm)}` : ''} (${t.rows.length})</option>`).join('')}</select>
        <input id="fQ" placeholder="검색: 테이블/컬럼/설명" value="${esc(editFilter.q)}" style="width:220px">
        <span class="muted">${list.length}행 표시</span>
      </div>
      <div class="table-wrap dd-grid-wrap"><table class="dd-grid">
        <thead><tr><th>#</th>${GRID.map((g) => `<th style="min-width:${g.w}px">${g.label}</th>`).join('')}<th></th></tr></thead>
        <tbody>${list.map((r, i) => `<tr>
          <td class="muted">${i + 1}</td>
          ${GRID.map((g) => {
    if (g.kind === 'yn') return `<td><select data-id="${r.id}" data-k="${g.k}"><option ${r[g.k] !== 'N' ? 'selected' : ''}>Y</option><option ${r[g.k] === 'N' ? 'selected' : ''}>N</option></select></td>`;
    if (g.kind === 'check') return `<td class="c"><input type="checkbox" data-id="${r.id}" data-k="${g.k}" ${r[g.k] === 'Y' ? 'checked' : ''}></td>`;
    return `<td><input data-id="${r.id}" data-k="${g.k}" value="${esc(r[g.k])}" style="width:${g.w}px"></td>`;
  }).join('')}
          <td><button class="btn sm" data-del="${r.id}" title="행 삭제">✕</button></td></tr>`).join('')}
        </tbody></table></div>`;

    $('#fTbl', body).onchange = (e) => { editFilter.tbl = e.target.value; drawBody(); };
    $('#fQ', body).oninput = (e) => {
      editFilter.q = e.target.value;
      const pos = e.target.selectionStart; drawBody();
      const n = $('#fQ', body); n.focus(); n.setSelectionRange(pos, pos);
    };
    $$('[data-del]', body).forEach((b) => {
      b.onclick = () => { state.rows = state.rows.filter((r) => String(r.id) !== b.dataset.del); save(); drawBody(); revalidate(); };
    });
    markCells();
  }

  function onCell(e) {
    const t = e.target; if (!t.dataset.id || !t.dataset.k) return;
    const r = state.rows.find((x) => String(x.id) === t.dataset.id); if (!r) return;
    const k = t.dataset.k;
    if (t.type === 'checkbox') {
      r[k] = t.checked ? 'Y' : '';
      if (k === 'pk' && t.checked) { r.nullable = 'N'; const s = $(`[data-id="${r.id}"][data-k="nullable"]`, el); if (s) s.value = 'N'; }
    } else if (e.type === 'change' && ['tbl', 'col', 'type'].includes(k)) {
      // 입력 완료 시 표준화 (대문자, "VARCHAR2(100)" 분리)
      const n = normalizeRow({ ...r, [k]: t.value });
      ['tbl', 'col', 'type', 'len'].forEach((f) => {
        r[f] = n[f]; const i = $(`[data-id="${r.id}"][data-k="${f}"]`, el); if (i && i !== document.activeElement) i.value = n[f];
      });
      t.value = n[k];
    } else r[k] = t.value;
    save(); revalidate();
  }

  $('#editBody', el).addEventListener('input', onCell);
  $('#editBody', el).addEventListener('change', onCell);
  drawIssues();
  drawBody();
}

// ═════════════════════════════════════════════
// 4. 확정
// ═════════════════════════════════════════════
function doConfirm() {
  const diff = diffRows(state.confirmed?.rows ?? [], state.rows);
  const version = (state.confirmed?.version ?? 0) + 1;
  const at = new Date().toISOString();
  state.confirmed = { version, at, hash: rowsHash(state.rows), rows: structuredClone(state.rows), project: { ...state.project } };
  state.history.unshift({ version, at, tables: tablesOf(state.rows).length, columns: state.rows.length, ...diff });
  state.history = state.history.slice(0, 30);
  save();
  return version;
}

function renderConfirm(el) {
  const r = v();
  const cur = isConfirmedCurrent();
  const diff = diffRows(state.confirmed?.rows ?? [], state.rows);
  const can = state.rows.length && !r.errors && !cur;
  el.innerHTML = `${head(stepOf('confirm'))}
  <p class="desc">확정하면 현재 컬럼정보가 버전(v1, v2 …)으로 고정되고, 산출물은 <b>확정된 버전</b> 기준으로 만들어집니다. 이후 수정하면 다시 확정해야 산출물에 반영됩니다.</p>
  <div class="dd-stats">
    <div class="dd-stat"><span>테이블</span><b>${tablesOf(state.rows).length}</b></div>
    <div class="dd-stat"><span>컬럼</span><b>${state.rows.length}</b></div>
    <div class="dd-stat ${r.errors ? 'fail' : ''}"><span>오류</span><b>${r.errors}</b></div>
    <div class="dd-stat ${r.warns ? 'warn' : ''}"><span>경고</span><b>${r.warns}</b></div>
  </div>
  <section class="card" style="margin-top:16px">
    <h2>${state.confirmed ? `현재 확정본 v${state.confirmed.version} 대비 변경` : '첫 확정'}</h2>
    ${state.confirmed ? `<p>추가 <b>${diff.added}</b> · 삭제 <b>${diff.removed}</b> · 변경 <b>${diff.changed}</b> 컬럼 <span class="muted">(확정: ${fmt(state.confirmed.at)})</span></p>` : '<p>아직 확정된 버전이 없습니다.</p>'}
    ${!state.rows.length ? '<p class="hint">컬럼정보가 없습니다. 2단계에서 먼저 가져오세요.</p>' : ''}
    ${r.errors ? `<p class="hint">오류 ${r.errors}건을 먼저 해결해야 확정할 수 있습니다. <a href="#/edit">검토·수정으로 이동</a></p>` : ''}
    ${!r.errors && r.warns ? `<p class="muted" style="margin-top:6px">경고 ${r.warns}건은 확정을 막지 않지만, 산출물 품질을 위해 확인을 권장합니다.</p>` : ''}
    ${cur ? `<p class="ok-line">✓ 현재 내용이 v${state.confirmed.version}로 확정되어 있습니다.</p>` : ''}
    <div class="toolbar" style="margin:14px 0 0">
      <button class="btn primary" id="doConfirm" ${can ? '' : 'disabled'}>${state.confirmed ? `v${state.confirmed.version + 1}로 확정` : 'v1로 확정'}</button>
      ${cur ? '<a class="btn" href="#/generate">산출물 생성으로 →</a>' : ''}
    </div>
  </section>
  <section class="card" style="margin-top:16px">
    <h2>확정 이력</h2>
    ${state.history.length ? `<div class="table-wrap"><table><thead><tr><th>버전</th><th>확정일시</th><th>테이블</th><th>컬럼</th><th>추가</th><th>삭제</th><th>변경</th></tr></thead><tbody>
      ${state.history.map((h) => `<tr style="cursor:default"><td><b>v${h.version}</b></td><td>${fmt(h.at)}</td><td>${h.tables}</td><td>${h.columns}</td><td>${h.added}</td><td>${h.removed}</td><td>${h.changed}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted">이력이 없습니다.</p>'}
  </section>`;
  $('#doConfirm', el).onclick = () => { const ver = doConfirm(); toast(`v${ver}로 확정했습니다`, 'success'); route(); };
}

// ═════════════════════════════════════════════
// 5. 산출물 양식
// ═════════════════════════════════════════════
let tplTab = 'tableDef';

function sampleCtx() {
  const rows = state.confirmed?.rows?.length ? state.confirmed.rows : state.rows;
  return { rows, project: state.project, template: state.template, version: state.confirmed?.version ?? 0 };
}

function renderTemplate(el) {
  const t = state.template;
  el.innerHTML = `${head(stepOf('template'), `<div class="toolbar" style="margin:0">
      <button class="btn" id="tplExport">양식 내보내기</button>
      <label class="btn">양식 가져오기<input type="file" id="tplImport" accept=".json" hidden></label>
      <button class="btn" id="tplReset">기본값으로</button></div>`)}
  <p class="desc">문서마다 들어갈 항목과 순서, 표시 이름을 정합니다. 바꾸면 바로 저장되고 오른쪽 미리보기에 반영됩니다. 양식 파일(.json)로 팀원과 같은 양식을 공유할 수 있습니다.</p>
  <section class="card dd-common">
    <label class="field">헤더 색상<input type="color" id="hColor" value="${esc(t.headerColor)}"></label>
    <label class="field" style="flex:2">파일명 규칙 <input id="fName" value="${esc(t.fileName)}"><small class="muted">{프로젝트} {시스템} {날짜} {버전} {문서}</small></label>
    <label class="field">출력 방식<select id="oMode"><option value="single" ${t.outputMode === 'single' ? 'selected' : ''}>한 파일에 시트로</option><option value="separate" ${t.outputMode === 'separate' ? 'selected' : ''}>문서별 파일</option></select></label>
  </section>
  <div class="seg" id="tplTabs" style="margin-top:16px">${Object.entries(DOC_TYPES).map(([k, d]) => `<button data-t="${k}">${esc(d.label)}</button>`).join('')}</div>
  <div class="dd-tpl">
    <section class="card" id="tplEdit"></section>
    <section class="card dd-tpl-prev"><h2>미리보기 <span class="muted" id="prevNote"></span></h2><div id="tplPrev"></div></section>
  </div>
  <p class="muted" style="margin-top:10px">※ 2차 예정: 사내 산출물 엑셀 양식(.xlsx)을 올리면 그 서식(로고·결재란·셀 스타일)에 그대로 채워 넣는 방식</p>`;

  const touch = () => { state.templateSavedAt = new Date().toISOString(); save(); renderSide(); drawPrev(); };
  $('#hColor', el).oninput = (e) => { t.headerColor = e.target.value; touch(); };
  $('#fName', el).oninput = (e) => { t.fileName = e.target.value; touch(); };
  $('#oMode', el).onchange = (e) => { t.outputMode = e.target.value; touch(); };
  $('#tplReset', el).onclick = () => { if (!confirm('양식을 기본값으로 되돌릴까요?')) return; state.template = defaultTemplate(); state.templateSavedAt = null; save(); route(); };
  $('#tplExport', el).onclick = () => downloadBlob(new Blob([JSON.stringify({ app: 'dbdoc-template', template: state.template }, null, 1)], { type: 'application/json' }), 'DB산출물_양식.json');
  $('#tplImport', el).onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.app !== 'dbdoc-template') throw new Error('양식 파일이 아닙니다');
      state.template = upgradeTemplate(j.template); touch(); toast('양식을 불러왔습니다', 'success'); route();
    } catch (err) { toast(err.message, 'error'); }
  };
  $$('#tplTabs button', el).forEach((b) => { b.onclick = () => { tplTab = b.dataset.t; drawEdit(); drawPrev(); }; });

  function listEditor(arr, items, part) {
    return `<ul class="dd-cols" data-part="${part}">${arr.map((c, i) => `<li class="${c.on ? '' : 'off'}">
      <input type="checkbox" data-i="${i}" data-a="on" ${c.on ? 'checked' : ''}>
      <input data-i="${i}" data-a="label" value="${esc(c.label)}" placeholder="${esc(items[c.key].label)}">
      <span class="muted">${esc(items[c.key].label)}</span>
      <button class="btn sm" data-i="${i}" data-a="up" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="btn sm" data-i="${i}" data-a="down" ${i === arr.length - 1 ? 'disabled' : ''}>↓</button>
    </li>`).join('')}</ul>`;
  }

  function drawEdit() {
    $$('#tplTabs button', el).forEach((b) => b.classList.toggle('on', b.dataset.t === tplTab));
    const d = t.docs[tplTab]; const type = DOC_TYPES[tplTab];
    const box = $('#tplEdit', el);
    box.innerHTML = `
      <p class="muted" style="margin-bottom:10px">${esc(type.desc)}</p>
      <label class="inline"><input type="checkbox" id="dOn" ${d.on ? 'checked' : ''}> 이 문서 생성</label>
      <label class="field" style="margin-top:10px">문서 제목<input id="dTitle" value="${esc(d.title)}"></label>
      ${tplTab === 'tableDef' ? `<label class="inline"><input type="checkbox" id="dSplit" ${d.split ? 'checked' : ''}> 테이블마다 시트 분리</label>
        <h3 class="dd-h3">머리말 항목 <span class="muted">(한 줄에 2개씩)</span></h3>${listEditor(d.meta, META_ITEMS, 'meta')}` : ''}
      <h3 class="dd-h3">표 항목</h3>${listEditor(d.columns, type.items, 'columns')}`;
    $('#dOn', box).onchange = (e) => { d.on = e.target.checked; touch(); };
    $('#dTitle', box).oninput = (e) => { d.title = e.target.value; touch(); };
    $('#dSplit', box)?.addEventListener('change', (e) => { d.split = e.target.checked; touch(); });
    $$('.dd-cols', box).forEach((ul) => {
      const arr = d[ul.dataset.part];
      ul.addEventListener('input', (e) => { const i = Number(e.target.dataset.i); if (e.target.dataset.a === 'label') { arr[i].label = e.target.value; touch(); } });
      ul.addEventListener('change', (e) => { const i = Number(e.target.dataset.i); if (e.target.dataset.a === 'on') { arr[i].on = e.target.checked; touch(); drawEdit(); } });
      ul.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const i = Number(b.dataset.i); const j = b.dataset.a === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]]; touch(); drawEdit();
      });
    });
  }

  function drawPrev() {
    const ctx = sampleCtx();
    const box = $('#tplPrev', el);
    $('#prevNote', el).textContent = ctx.rows.length ? `· ${state.confirmed?.rows?.length ? `확정본 v${state.confirmed.version}` : '작업 중 데이터'} 기준` : '';
    if (!ctx.rows.length) { box.innerHTML = '<div class="state">컬럼정보가 있어야 미리보기가 표시됩니다.</div>'; return; }
    if (!t.docs[tplTab].on) { box.innerHTML = '<div class="state">이 문서는 생성하지 않도록 설정되어 있습니다.</div>'; return; }
    box.innerHTML = `<div class="doc-prev">${previewHtml(buildDoc(tplTab, ctx), { color: t.headerColor, maxSections: 2, maxRows: 12, maxSheets: 2 })}</div>`;
  }
  drawEdit(); drawPrev();
}

// ═════════════════════════════════════════════
// 6. 산출물 생성
// ═════════════════════════════════════════════
let genPrevTab = null;

async function generateFiles() {
  const c = state.confirmed;
  const ctx = { rows: c.rows, project: state.project, template: state.template, version: c.version };
  const docs = buildAll(ctx);
  if (!docs.length) throw new Error('생성할 문서가 없습니다. 5단계에서 문서를 하나 이상 선택하세요.');
  const t = state.template;
  const files = [];
  if (t.outputMode === 'separate') {
    for (const d of docs) {
      const pattern = t.fileName.includes('{문서}') ? t.fileName : `${t.fileName}_{문서}`;
      const name = applyFileName(pattern, ctx, d.title);
      downloadBlob(await docsToBlob([d], t.headerColor), name);
      files.push(name);
      await sleep(400);
    }
  } else {
    const name = applyFileName(t.fileName.replaceAll('{문서}', 'DB산출물'), ctx);
    downloadBlob(await docsToBlob(docs, t.headerColor), name);
    files.push(name);
  }
  state.lastGenerated = { at: new Date().toISOString(), version: c.version, files };
  save();
  return files;
}

function renderGenerate(el) {
  const c = state.confirmed;
  if (!c) {
    el.innerHTML = `${head(stepOf('generate'))}<section class="card"><div class="state">확정된 컬럼정보가 없습니다. <a href="#/confirm">4단계에서 확정</a>한 뒤 생성할 수 있습니다.</div></section>`;
    return;
  }
  const t = state.template;
  const ctx = { rows: c.rows, project: state.project, template: t, version: c.version };
  const docKeys = Object.keys(DOC_TYPES);
  if (!genPrevTab || !t.docs[genPrevTab]?.on) genPrevTab = docKeys.find((k) => t.docs[k].on) ?? null;
  const single = applyFileName(t.fileName.replaceAll('{문서}', 'DB산출물'), ctx);

  el.innerHTML = `${head(stepOf('generate'))}
  <p class="desc"><b>확정본 v${c.version}</b> (${fmt(c.at)}, 테이블 ${tablesOf(c.rows).length}개 · 컬럼 ${c.rows.length}개) 기준으로 산출물을 만듭니다.</p>
  ${!isConfirmedCurrent() ? '<p class="hint">확정 이후 수정된 내용이 있습니다. 수정본을 반영하려면 <a href="#/confirm">다시 확정</a>하세요.</p>' : ''}
  <section class="card">
    <h2>생성할 문서</h2>
    <div class="dd-docpick">${docKeys.map((k) => `<label class="dd-doc ${t.docs[k].on ? 'on' : ''}"><input type="checkbox" data-doc="${k}" ${t.docs[k].on ? 'checked' : ''}><b>${esc(t.docs[k].title)}</b><small>${esc(DOC_TYPES[k].desc)}</small></label>`).join('')}</div>
    <div class="toolbar" style="margin:14px 0 0">
      <button class="btn primary" id="genGo">엑셀 다운로드</button>
      <span class="muted">${t.outputMode === 'single' ? `파일: ${esc(single)}` : '문서별 파일로 각각 다운로드'} · <a href="#/template">양식 변경</a></span>
    </div>
    ${state.lastGenerated ? `<p class="muted" style="margin-top:8px">마지막 생성: ${fmt(state.lastGenerated.at)} · v${state.lastGenerated.version} · ${state.lastGenerated.files.map(esc).join(', ')}</p>` : ''}
  </section>
  <section class="card" style="margin-top:16px">
    <div class="dd-card-head"><h2>미리보기</h2><div class="seg sm" id="gTabs">${docKeys.filter((k) => t.docs[k].on).map((k) => `<button data-t="${k}" class="${k === genPrevTab ? 'on' : ''}">${esc(t.docs[k].title)}</button>`).join('')}</div></div>
    <div class="doc-prev" id="gPrev">${genPrevTab ? previewHtml(buildDoc(genPrevTab, ctx), { color: t.headerColor }) : '<div class="state">선택된 문서가 없습니다.</div>'}</div>
  </section>`;

  $$('[data-doc]', el).forEach((cb) => { cb.onchange = () => { t.docs[cb.dataset.doc].on = cb.checked; save(); route(); }; });
  $$('#gTabs button', el).forEach((b) => { b.onclick = () => { genPrevTab = b.dataset.t; route(); }; });
  $('#genGo', el).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="spinner"></span>생성 중…';
    try { const files = await generateFiles(); toast(`${files.length}개 파일을 만들었습니다`, 'success'); route(); } catch (err) { toast(err.message, 'error'); b.disabled = false; b.textContent = '엑셀 다운로드'; }
  };
}

// ═════════════════════════════════════════════
// 7. DB 자동 생성 (향후 기능 — 목업)
// ═════════════════════════════════════════════
const SQL = {
  Oracle: `SELECT c.TABLE_NAME, tc.COMMENTS AS TABLE_COMMENTS,
       c.COLUMN_NAME, cc.COMMENTS AS COLUMN_COMMENTS,
       c.DATA_TYPE,
       CASE WHEN c.DATA_TYPE = 'NUMBER' AND c.DATA_PRECISION IS NOT NULL
            THEN c.DATA_PRECISION || NVL2(NULLIF(c.DATA_SCALE,0), ','||c.DATA_SCALE, '')
            WHEN c.DATA_TYPE IN ('DATE','CLOB','BLOB') THEN NULL
            ELSE TO_CHAR(c.CHAR_LENGTH) END AS DATA_LENGTH,
       c.NULLABLE, c.DATA_DEFAULT,
       (SELECT 'Y' FROM ALL_CONS_COLUMNS k JOIN ALL_CONSTRAINTS p
          ON p.OWNER = k.OWNER AND p.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND p.CONSTRAINT_TYPE = 'P'
        WHERE k.OWNER = c.OWNER AND k.TABLE_NAME = c.TABLE_NAME AND k.COLUMN_NAME = c.COLUMN_NAME) AS PK
  FROM ALL_TAB_COLUMNS c
  LEFT JOIN ALL_TAB_COMMENTS tc ON tc.OWNER = c.OWNER AND tc.TABLE_NAME = c.TABLE_NAME
  LEFT JOIN ALL_COL_COMMENTS cc ON cc.OWNER = c.OWNER AND cc.TABLE_NAME = c.TABLE_NAME AND cc.COLUMN_NAME = c.COLUMN_NAME
 WHERE c.OWNER = :schema
 ORDER BY c.TABLE_NAME, c.COLUMN_ID`,
  'MySQL / MariaDB': `SELECT c.TABLE_NAME, t.TABLE_COMMENT,
       c.COLUMN_NAME, c.COLUMN_COMMENT,
       UPPER(c.DATA_TYPE) AS DATA_TYPE,
       COALESCE(c.CHARACTER_MAXIMUM_LENGTH,
                CONCAT(c.NUMERIC_PRECISION, IF(c.NUMERIC_SCALE > 0, CONCAT(',', c.NUMERIC_SCALE), ''))) AS DATA_LENGTH,
       IF(c.IS_NULLABLE = 'YES', 'Y', 'N') AS NULLABLE,
       IF(c.COLUMN_KEY = 'PRI', 'Y', '') AS PK,
       c.COLUMN_DEFAULT
  FROM information_schema.COLUMNS c
  JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
 WHERE c.TABLE_SCHEMA = ?
 ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`,
  PostgreSQL: `SELECT c.table_name, obj_description(pc.oid) AS table_comment,
       c.column_name, col_description(pc.oid, c.ordinal_position) AS column_comment,
       upper(c.data_type) AS data_type,
       coalesce(c.character_maximum_length::text,
                c.numeric_precision || coalesce(',' || nullif(c.numeric_scale, 0), '')) AS data_length,
       CASE WHEN c.is_nullable = 'YES' THEN 'Y' ELSE 'N' END AS nullable,
       c.column_default
  FROM information_schema.columns c
  JOIN pg_class pc ON pc.relname = c.table_name
  JOIN pg_namespace n ON n.oid = pc.relnamespace AND n.nspname = c.table_schema
 WHERE c.table_schema = $1
 ORDER BY c.table_name, c.ordinal_position`,
};

function renderAuto(el) {
  state.conn ??= { dbms: state.project.dbms || 'Oracle', host: '', port: '', db: '', schema: '' };
  const cn = state.conn;
  const sql = SQL[cn.dbms] ?? SQL.Oracle;
  el.innerHTML = `${head(stepOf('auto'))}
  <p class="desc">최종 목표 화면입니다. 연결된 DB에서 메타데이터를 읽어 <b>추출 → 검증 → 확정 → 생성</b>을 한 번에 실행합니다.
  지금은 백엔드가 없어 <code>mock/db-columns.json</code>을 DB 조회 결과로 가정해 동작을 흉내 냅니다.</p>

  <div class="dd-arch">
    <div><b>브라우저 (이 화면)</b><small>연결 선택 · 실행 · 산출물 다운로드</small></div><span>→</span>
    <div><b>백엔드 API</b><small>접속정보·계정 보관, 메타데이터 SQL 실행</small></div><span>→</span>
    <div><b>운영/개발 DB</b><small>시스템 카탈로그 조회 (읽기 전용 계정)</small></div>
  </div>
  <p class="muted" style="margin:6px 0 16px">브라우저는 DB에 직접 접속할 수 없고, DB 계정을 화면에 두면 안 되므로 백엔드 API가 필요합니다.</p>

  <div class="cols">
    <section class="card">
      <h2>DB 연결 (예정)</h2>
      <div class="dd-form two">
        <label class="field">DBMS<select data-c="dbms">${DBMS_LIST.map((d) => `<option ${d === cn.dbms ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
        <label class="field">스키마/OWNER<input data-c="schema" value="${esc(cn.schema)}" placeholder="예: OMS"></label>
        <label class="field">호스트<input data-c="host" value="${esc(cn.host)}" placeholder="예: dev-db.mycompany.com"></label>
        <label class="field">포트<input data-c="port" value="${esc(cn.port)}" placeholder="1521"></label>
        <label class="field" style="grid-column:1/-1">DB명 / 서비스명<input data-c="db" value="${esc(cn.db)}" placeholder="예: ORCLPDB"></label>
      </div>
      <p class="muted">계정·비밀번호는 화면에서 받지 않고 백엔드 설정으로 관리하는 것을 전제로 합니다.</p>
      <div class="toolbar" style="margin:12px 0 0">
        <button class="btn" id="connTest">연결 테스트</button>
        <button class="btn primary" id="oneClick">원클릭 자동 생성</button>
      </div>
      <ol class="dd-pipe" id="pipe"></ol>
    </section>
    <section class="card">
      <h2>메타데이터 조회 SQL <span class="muted">· ${esc(cn.dbms)}</span></h2>
      <pre class="dd-sql">${esc(sql)}</pre>
      <h2 style="margin-top:16px">백엔드 API (설계안)</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>메서드</th><th>경로</th><th>용도</th></tr></thead>
        <tbody style="cursor:default">
          <tr><td>GET</td><td><code>/api/db/connections</code></td><td>등록된 연결 목록</td></tr>
          <tr><td>POST</td><td><code>/api/db/test</code></td><td>연결 테스트</td></tr>
          <tr><td>POST</td><td><code>/api/db/metadata</code></td><td>스키마 메타데이터 추출 → 컬럼정보 행 반환</td></tr>
          <tr><td>POST</td><td><code>/api/docs/confirm</code></td><td>확정 버전 저장 (서버 이력 관리)</td></tr>
          <tr><td>POST</td><td><code>/api/docs/generate</code></td><td>(선택) 서버에서 사내 양식 엑셀 생성</td></tr>
        </tbody>
      </table></div>
    </section>
  </div>`;

  $$('[data-c]', el).forEach((i) => {
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { cn[i.dataset.c] = i.value.trim(); save(); if (i.dataset.c === 'dbms') route(); });
  });

  const pipe = $('#pipe', el);
  const run = async (steps) => {
    pipe.innerHTML = steps.map((s, i) => `<li data-i="${i}"><span class="dd-dot"></span><b>${esc(s.label)}</b><small></small></li>`).join('');
    for (let i = 0; i < steps.length; i += 1) {
      const li = $(`[data-i="${i}"]`, pipe);
      li.className = 'run';
      try {
        const msg = await steps[i].fn();
        li.className = 'ok'; li.querySelector('small').textContent = msg ?? '';
      } catch (err) {
        li.className = 'fail'; li.querySelector('small').textContent = err.message;
        return false;
      }
    }
    return true;
  };
  const connStep = { label: 'DB 연결 확인', fn: async () => { await sleep(500); return `${cn.dbms} ${cn.host || '(호스트 미입력)'} — 목업 응답: 연결 성공`; } };

  $('#connTest', el).onclick = () => run([connStep]);
  $('#oneClick', el).onclick = async () => {
    if (state.rows.length && !confirm('현재 컬럼정보를 DB 추출 결과로 바꾸고, 확정·산출물 생성까지 진행합니다. 계속할까요?')) return;
    let extracted = [];
    const ok = await run([
      connStep,
      { label: '메타데이터 추출', fn: async () => { await sleep(400); const s = await loadMockSheet(); extracted = applyMapping(s, autoMap(s.headers)); return `${tablesOf(extracted).length}개 테이블 · ${extracted.length}개 컬럼`; } },
      { label: '검증', fn: async () => { await sleep(300); state.rows = extracted.map((r) => newRow(r)); save(); const r = v(); if (r.errors) throw new Error(`오류 ${r.errors}건 — 3단계에서 확인 필요`); return `오류 0 · 경고 ${r.warns}`; } },
      { label: '확정', fn: async () => { await sleep(300); if (isConfirmedCurrent()) return `변경 없음 — v${state.confirmed.version} 유지`; return `v${doConfirm()} 확정`; } },
      { label: '산출물 생성', fn: async () => { const files = await generateFiles(); return files.join(', '); } },
    ]);
    renderSide();
    toast(ok ? '자동 생성이 끝났습니다' : '중간에 멈췄습니다', ok ? 'success' : 'error');
  };
}

// ── 시작 ────────────────────────────────────
window.addEventListener('hashchange', route);
route();
