// ─────────────────────────────────────────────
// 프로젝트 공통 설정 — API 주소/모드는 여기서만 바꾸세요.
// ─────────────────────────────────────────────
export const CONFIG = {
  APP_NAME: '기능 초안 프로토타입',
  VERSION: '0.1.0',

  // 실제 API 서버 주소 (현재는 테스트용 공개 API)
  // 실제 백엔드가 준비되면 예: 'https://dev-api.mycompany.com'
  API_BASE_URL: 'https://jsonplaceholder.typicode.com',

  // 기본 API 모드: 'live' = 실제 호출, 'mock' = /mock/*.json 사용
  DEFAULT_API_MODE: 'live',

  // 요청 타임아웃(ms)
  TIMEOUT_MS: 8000,

  // mock 모드 응답 지연(ms) — 로딩 UI 확인용
  MOCK_DELAY_MS: 300,

  // 공통 요청 헤더 (인증 토큰 등)
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    // 'Authorization': 'Bearer <TOKEN>',
  },
};

// 프로젝트 루트 / mock 폴더 경로 (GitHub Pages 하위경로에서도 동작)
export const ROOT_URL = new URL('../../', import.meta.url).href;
export const MOCK_BASE_URL = new URL('mock/', ROOT_URL).href;

const MODE_KEY = 'proto.apiMode';

export function getApiMode() {
  try {
    return localStorage.getItem(MODE_KEY) || CONFIG.DEFAULT_API_MODE;
  } catch {
    return CONFIG.DEFAULT_API_MODE;
  }
}

export function setApiMode(mode) {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* 무시 */ }
}
