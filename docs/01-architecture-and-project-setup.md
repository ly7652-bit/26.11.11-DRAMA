# 01. 프로젝트 구조 및 생성 지침

## 1. 기술 구성
- Front End: HTML5, CSS3, Vanilla JavaScript
- Back End: Node.js 기반 Vercel Serverless Functions
- AI: OpenAI API
- DB: Supabase PostgreSQL
- 배포: Vercel

프론트엔드와 API를 하나의 저장소에서 관리한다. 정적 파일은 루트의 `public/`에 둔다. API 함수는 Vercel이 인식하는 `api/`에 둔다.

## 2. 권장 폴더 구조
```text
project-root/
├─ AGENTS.md
├─ PRD.md
├─ package.json
├─ vercel.json                 # 필요한 경우에만 사용
├─ .env.example                # 실제 키 금지
├─ .gitignore
├─ public/
│  ├─ index.html
│  ├─ css/
│  │  └─ styles.css
│  ├─ js/
│  │  ├─ app.js
│  │  ├─ api.js
│  │  ├─ render.js
│  │  └─ validation.js
│  └─ assets/
├─ api/
│  ├─ recommend.js
│  └─ feedback/
│     ├─ index.js              # GET 목록, POST 생성
│     └─ [id].js               # 필요할 때만 상세/삭제; 기본 요구에는 미구현
├─ supabase/
│  └─ schema.sql
└─ docs/
   ├─ 01-architecture-and-project-setup.md
   ├─ 02-ui-implementation.md
   ├─ 03-frontend-implementation.md
   ├─ 04-backend-and-openai.md
   ├─ 05-supabase-and-feedback.md
   └─ 06-deployment-and-testing.md
```

## 3. 프로젝트 생성 원칙
- `npm init -y`로 Node 프로젝트를 만든다.
- 런타임 의존성은 실제 필요한 것만 설치한다. 예: `openai`, `@supabase/supabase-js`.
- 프론트엔드 빌드 도구/프레임워크는 추가하지 않는다.
- 개발용 실행 스크립트는 Vercel CLI 또는 정적 서버를 활용하되, API 함수까지 로컬 검증하려면 Vercel CLI 사용을 권장한다.
- Node.js 버전은 현재 Vercel에서 지원하는 LTS를 확인해 `engines`에 명시한다.
- `.gitignore`에 `node_modules/`, `.env*`(단 `.env.example` 예외), `.vercel/` 등을 포함한다.

## 4. 기본 실행 흐름
1. 브라우저가 `public/index.html`을 연다.
2. JavaScript가 `/api/recommend` 또는 `/api/feedback`으로 요청한다.
3. Vercel Node 함수가 입력을 검증한다.
4. 추천 요청은 OpenAI API, 피드백은 Supabase에 연결한다.
5. API는 정해진 JSON 형식으로 결과를 반환한다.
6. 브라우저는 결과를 안전하게 DOM에 표시한다.

## 5. 구현 금지 사항
- OpenAI API를 브라우저에서 직접 호출하지 않는다.
- Supabase `service_role` 키를 프론트엔드에 넣지 않는다.
- `.env` 파일을 Git에 커밋하지 않는다.
- 사용자가 요구하지 않은 프레임워크, 인증, 결제, 외부 작품 DB를 추가하지 않는다.
- CORS를 무조건 전체 허용하는 별도 서버를 만들지 않는다. 동일 출처 API를 기본으로 한다.

## 6. 산출물
- 실행 가능한 소스 구조
- `.env.example`
- `supabase/schema.sql`
- 문서에 정의된 API 계약 구현
- 로컬 실행 및 Vercel 배포 안내
