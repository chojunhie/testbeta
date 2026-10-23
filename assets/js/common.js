// ─────────────────────────────────────────────
// 공통 UI: 헤더/네비게이션, API 모드 토글, 토스트, API 로그 패널
// 새 페이지는 menu 배열에 한 줄 추가하면 네비게이션에 노출됩니다.
// ─────────────────────────────────────────────
import { CONFIG, ROOT_URL, getApiMode, setApiMode } from './config.js';
import { onApiLog } from './api.js';

export const MENU = [
  { key: 'home', label: '홈', href: 'index.html' },
  { key: 'dbdoc', label: 'DB 산출물', href: 'pages/db-docs.html' },
  { key: 'setup', label: '세팅 확인', href: 'pages/setup-check.html' },
  { key: 'api', label: 'API 연동 샘플', href: 'pages/api-sample.html' },
  { key: 'template', label: '새 기능 템플릿', href: 'pages/_template.html' },
];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderHeader(activeKey) {
  const header = document.createElement('header');
  header.className = 'app-header';
  const mode = getApiMode();
  header.innerHTML = `
    <a class="brand" href="${ROOT_URL}index.html">${esc(CONFIG.APP_NAME)} <small>v${esc(CONFIG.VERSION)}</small></a>
    <nav>${MENU.map((m) => `<a href="${ROOT_URL}${m.href}" class="${m.key === activeKey ? 'active' : ''}">${esc(m.label)}</a>`).join('')}</nav>
    <label class="mode-toggle" title="API 호출 방식 전환">
      <span>API</span>
      <select id="apiModeSelect">
        <option value="live" ${mode === 'live' ? 'selected' : ''}>LIVE</option>
        <option value="mock" ${mode === 'mock' ? 'selected' : ''}>MOCK</option>
      </select>
    </label>`;
  document.body.prepend(header);
  header.querySelector('#apiModeSelect').addEventListener('change', (e) => {
    setApiMode(e.target.value);
    toast(`API 모드: ${e.target.value.toUpperCase()} — 새로고침합니다`);
    setTimeout(() => location.reload(), 600);
  });
}

export function toast(message, type = 'info') {
  let box = document.querySelector('.toast-box');
  if (!box) { box = document.createElement('div'); box.className = 'toast-box'; document.body.append(box); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  box.append(el);
  setTimeout(() => el.remove(), 2800);
}

// 화면 하단 API 로그 패널 (요청/응답 확인용)
export function mountApiLog() {
  const panel = document.createElement('details');
  panel.className = 'api-log';
  panel.innerHTML = `<summary>API 로그 <span class="count">0</span></summary><ol></ol>`;
  document.body.append(panel);
  const list = panel.querySelector('ol');
  const count = panel.querySelector('.count');
  let n = 0;
  onApiLog((e) => {
    n += 1; count.textContent = n;
    const li = document.createElement('li');
    li.className = e.ok ? 'ok' : 'fail';
    li.innerHTML = `
      <div class="row">
        <b>${esc(e.method)}</b> <code>${esc(e.path)}</code>
        <span class="tag">${esc(e.mode)}</span>
        <span class="tag ${e.ok ? 'ok' : 'fail'}">${e.ok ? e.status : esc(e.error)}</span>
        <span class="muted">${e.ms}ms · ${e.time.toLocaleTimeString()}</span>
      </div>
      <pre>${esc(JSON.stringify(e.response, null, 2)?.slice(0, 1500) ?? '')}</pre>`;
    list.prepend(li);
  });
}

export function initPage(activeKey, { apiLog = true } = {}) {
  renderHeader(activeKey);
  if (apiLog) mountApiLog();
}
