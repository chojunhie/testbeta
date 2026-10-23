// ─────────────────────────────────────────────
// API 공통 모듈
//  - live 모드: CONFIG.API_BASE_URL 로 실제 fetch
//  - mock 모드: /mock/{resource}.json 을 읽어 흉내 (DB 없이 화면 확인용)
//  - 모든 요청/응답은 onApiLog() 로 구독 가능 (화면 하단 로그 패널)
// ─────────────────────────────────────────────
import { CONFIG, MOCK_BASE_URL, getApiMode } from './config.js';

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, url = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.url = url;
  }
}

const listeners = new Set();
export function onApiLog(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(entry) { listeners.forEach((fn) => { try { fn(entry); } catch { /* 무시 */ } }); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── live 요청 ───────────────────────────────
async function liveRequest(path, { method, body, headers, timeout }) {
  const url = CONFIG.API_BASE_URL.replace(/\/$/, '') + path;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      headers: { ...CONFIG.DEFAULT_HEADERS, ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, { status: res.status, data, url });
    return { status: res.status, data, url };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') throw new ApiError(`타임아웃 (${timeout}ms)`, { url });
    // CORS 차단·네트워크 오류는 브라우저에서 모두 TypeError 로 옵니다.
    throw new ApiError('네트워크 오류 또는 CORS 차단', { url });
  } finally {
    clearTimeout(timer);
  }
}

// ── mock 요청 ───────────────────────────────
// GET /users          → mock/users.json
// GET /users/3        → users.json 중 id=3
// GET /posts?userId=1 → posts.json 중 userId=1 필터
// POST/PUT/PATCH/DELETE → 저장 없이 성공 응답만 흉내
async function mockRequest(path, { method, body }) {
  await sleep(CONFIG.MOCK_DELAY_MS);
  const [pathname, qs = ''] = path.split('?');
  const [resource, id] = pathname.replace(/^\//, '').split('/');
  const url = `${MOCK_BASE_URL}${resource}.json`;

  if (method !== 'GET') {
    const data = method === 'DELETE' ? {} : { ...body, id: id ? Number(id) : Date.now() % 100000 };
    return { status: method === 'POST' ? 201 : 200, data, url: `${url} (mock ${method})` };
  }

  const res = await fetch(url);
  if (!res.ok) throw new ApiError(`mock 파일 없음: ${resource}.json`, { status: 404, url });
  let data = await res.json();

  if (id !== undefined) {
    data = Array.isArray(data) ? data.find((x) => String(x.id) === id) : null;
    if (!data) throw new ApiError('Not Found (mock)', { status: 404, url });
  } else if (qs && Array.isArray(data)) {
    const params = new URLSearchParams(qs);
    data = data.filter((row) => [...params].every(([k, v]) => String(row[k]) === v));
  }
  return { status: 200, data, url };
}

// ── 공통 진입점 ─────────────────────────────
export async function request(path, { method = 'GET', body, headers = {}, timeout = CONFIG.TIMEOUT_MS } = {}) {
  const mode = getApiMode();
  const started = performance.now();
  const entry = { id: crypto.randomUUID?.() ?? String(Math.random()), mode, method, path, body, time: new Date() };
  try {
    const result = mode === 'mock'
      ? await mockRequest(path, { method, body })
      : await liveRequest(path, { method, body, headers, timeout });
    emit({ ...entry, ok: true, status: result.status, url: result.url, ms: Math.round(performance.now() - started), response: result.data });
    return result.data;
  } catch (err) {
    emit({ ...entry, ok: false, status: err.status ?? 0, url: err.url, ms: Math.round(performance.now() - started), error: err.message, response: err.data });
    throw err;
  }
}

export const api = {
  get: (path, opt) => request(path, { ...opt, method: 'GET' }),
  post: (path, body, opt) => request(path, { ...opt, method: 'POST', body }),
  put: (path, body, opt) => request(path, { ...opt, method: 'PUT', body }),
  patch: (path, body, opt) => request(path, { ...opt, method: 'PATCH', body }),
  del: (path, opt) => request(path, { ...opt, method: 'DELETE' }),
};
