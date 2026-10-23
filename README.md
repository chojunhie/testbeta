# 기능 초안 프로토타입 (HTML + API 연동, DB 없음)

설계 단계에서 기능 화면을 HTML로 빠르게 만들고, Git으로 관리하며, 브라우저에서 바로 확인하기 위한 스타터입니다.
빌드 도구·프레임워크 없이 **순수 HTML/CSS/JS(ES Module)** 만 사용합니다.

---

## 1. 초기 세팅 순서

### STEP 0. 사전 설치 (최초 1회)
| 항목 | 용도 | 확인 명령 |
|---|---|---|
| Git | 버전 관리 | `git --version` |
| VS Code | 편집기 | - |
| VS Code 확장 **Live Server** | 로컬 웹서버 (필수) | 우측 하단 `Go Live` 버튼 |
| GitHub 계정 | 원격 저장소 / 화면 공유용 배포 | - |
| (선택) Node.js | `npx serve` 로 서버 실행 시 | `node -v` |

> ⚠️ HTML 파일을 더블클릭(file://)으로 열면 ES Module·fetch가 막혀 동작하지 않습니다. **반드시 웹서버로 실행**하세요.

### STEP 1. Git 사용자 설정 (최초 1회)
```bash
git config --global user.name  "홍길동"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

### STEP 2. GitHub 저장소 생성
GitHub → **New repository** → 이름 예: `feature-prototype` → README 체크 해제 → Create

### STEP 3. 스타터 파일을 저장소로 연결
```bash
# 압축 푼 proto-starter 폴더로 이동
cd proto-starter

git init
git add .
git commit -m "chore: 프로토타입 초기 세팅"
git remote add origin https://github.com/<계정>/feature-prototype.git
git push -u origin main
```

### STEP 4. 로컬 실행
- VS Code로 폴더 열기 → 권장 확장 설치 알림 수락 → 우측 하단 **Go Live**
- 또는 터미널에서 `npx serve .` / `python -m http.server 5500`
- 브라우저: `http://127.0.0.1:5500/`

### STEP 5. 세팅 확인 페이지 점검 ✅
`http://127.0.0.1:5500/pages/setup-check.html` 접속 → 7개 항목 모두 ✅ 이면 완료

| 점검 항목 | 실패 시 조치 |
|---|---|
| 로컬 웹서버 실행 | Live Server로 다시 열기 |
| CSS / JS 모듈 로드 | 경로·파일명 확인 |
| 목업(mock) 데이터 로드 | `mock/` 폴더 위치 확인 |
| 외부 API 호출 (CORS) | 사내망/방화벽·CORS 확인, 임시로 MOCK 모드 사용 |
| 브라우저 저장소 | 시크릿 모드면 경고만 (동작 무관) |
| 배포 경로 | - |

### STEP 6. GitHub Pages 배포 (팀 공유용 URL)
저장소 **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**
1~2분 후 `https://<계정>.github.io/feature-prototype/` 에서 확인 → 같은 세팅 확인 페이지로 점검
> `.nojekyll` 파일이 있어야 `_template.html` 처럼 `_`로 시작하는 파일도 배포됩니다. 지우지 마세요.
> 비공개 저장소의 Pages는 유료 플랜이 필요할 수 있습니다.

### STEP 7. 기능 초안 작업 흐름 (반복)
```bash
git switch -c feature/login           # 1. 기능 브랜치
cp pages/_template.html pages/login.html   # 2. 템플릿 복사 후 작성
# 3. assets/js/common.js 의 MENU 에 메뉴 추가, index.html 목록에 추가
git add . && git commit -m "feat(login): 로그인 화면 초안"
git push -u origin feature/login      # 4. GitHub에서 PR → 리뷰 → main 병합 → Pages 자동 반영
```
커밋 접두어 예: `feat` 기능 · `fix` 수정 · `design` 화면 · `docs` 문서 · `chore` 설정

---

## 기능 초안: DB 산출물 자동화 (`pages/db-docs.html`)
좌측 단계 메뉴 → 우측 기능 영역 구성.
1. 프로젝트 정보 → 2. 컬럼정보 가져오기(엑셀/CSV 업로드·붙여넣기·샘플, 헤더 자동 매핑) → 3. 검토·수정(그리드 편집, 자동 검증) → 4. 확정(버전·변경 이력) → 5. 산출물 양식(문서별 항목·순서·제목, 양식 JSON 공유) → 6. 산출물 생성(미리보기 + 엑셀 다운로드) → 7. DB 자동 생성(목업: `mock/db-columns.json`을 DB 조회 결과로 가정)

- 코드: `assets/js/dbdoc/` — `fields.js`(항목·헤더 별칭) · `importer.js` · `validate.js` · `docs.js`(문서 모델·엑셀) · `state.js` · `app.js`(화면)
- 엑셀 읽기/쓰기: ExcelJS (CDN)
- 저장: 초안은 브라우저 localStorage — 개요 화면에서 백업(.json) 내보내기/가져오기
- 사내 엑셀 헤더명이 다르면 `fields.js`의 `aliases`에 추가

---

## 2. 폴더 구조
```
proto-starter/
├─ index.html              # 허브(기능 초안 목록)
├─ pages/
│  ├─ setup-check.html     # ✅ 세팅 확인 페이지
│  ├─ api-sample.html      # API 연동 샘플 (목록/상세/등록)
│  └─ _template.html       # 새 기능 초안 템플릿
├─ assets/
│  ├─ css/common.css       # 공통 스타일 (라이트/다크)
│  └─ js/
│     ├─ config.js         # ★ API 주소·모드·헤더 설정
│     ├─ api.js            # fetch 래퍼 (타임아웃, 에러, mock 라우팅, 로그)
│     └─ common.js         # 헤더/메뉴, 토스트, API 로그 패널
├─ mock/                   # DB 대신 쓰는 목업 JSON
│  ├─ users.json
│  └─ posts.json
├─ api-test.http           # REST Client 로 API 단독 테스트
├─ .vscode/                # Live Server·권장 확장 설정
├─ .gitignore / .editorconfig / .nojekyll
```

---

## 3. API 연동 방법

```js
import { api } from '../assets/js/api.js';

const users = await api.get('/users');               // 목록
const user  = await api.get('/users/1');             // 상세
const posts = await api.get('/posts?userId=1');      // 조건 조회
const saved = await api.post('/posts', { title, body, userId }); // 등록
await api.put('/posts/1', data);  await api.del('/posts/1');
```

- **주소 변경**: `assets/js/config.js` 의 `API_BASE_URL` 한 곳만 수정
- **인증 토큰**: `DEFAULT_HEADERS` 에 `Authorization` 추가 (실제 토큰은 커밋 금지)
- **LIVE / MOCK 전환**: 화면 상단 `API` 셀렉트 (브라우저에 기억됨)
- **MOCK 규칙**: `GET /리소스` → `mock/리소스.json`, `/리소스/:id` → id 검색, `?키=값` → 필터. POST/PUT/DELETE는 저장 없이 성공 응답만 흉내
- **요청/응답 확인**: 화면 하단 `API 로그` 패널 + 브라우저 개발자도구(F12) Network 탭

### CORS 오류가 날 때
브라우저에서 다른 도메인 API를 직접 호출하면 서버가 CORS를 허용해야 합니다.
1. 백엔드에 개발용 Origin 허용 요청: `http://127.0.0.1:5500`, `https://<계정>.github.io`
2. 그 전까지는 **MOCK 모드**로 화면 작업 진행 → `mock/*.json` 을 API 명세 응답 형태로 맞춰 두면 실제 연동 시 코드 변경 없음
