# 05. Supabase DB 및 익명 피드백 구현 지침

## 1. 데이터베이스
테이블명: `feedback`

| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| id | uuid | PK, `gen_random_uuid()` |
| name | text | nullable, 최대 40자 |
| content | text | not null, 2~1000자 |
| created_at | timestamptz | not null, `now()` |

이메일, 전화번호, 로그인 ID 등 요구되지 않은 개인정보는 수집하지 않는다.

## 2. SQL 예시
```sql
create extension if not exists pgcrypto;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  name text null check (name is null or char_length(name) <= 40),
  content text not null check (char_length(trim(content)) between 2 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

alter table public.feedback enable row level security;
```

## 3. RLS 정책과 접근
권장 기본 구성:
- 브라우저에서 Supabase에 직접 접근하지 않고 Node API를 통해 접근한다.
- 서버는 `SUPABASE_SERVICE_ROLE_KEY`를 사용하되 서버 함수 내부에서만 사용한다.
- service role 키는 RLS를 우회할 수 있으므로 API에서 반드시 입력 검증, 길이 제한, 요청 제한을 수행한다.
- 공개 사용자에게 수정/삭제 API를 제공하지 않는다.
- DB의 RLS는 활성화 상태로 유지한다.
- 서버 API가 아닌 익명 브라우저 클라이언트에 service role 키를 절대 노출하지 않는다.

대안으로 anon key 직접 접근 구조를 선택한다면 INSERT/SELECT RLS 정책을 별도로 설계해야 한다. 이 프로젝트 기본안은 서버 경유 방식이다.

## 4. 피드백 생성 API
`POST /api/feedback`
- name: 문자열 또는 빈 값, trim 후 최대 40자. 빈 값은 DB에 null로 저장
- content: trim 후 2~1000자
- SQL 파라미터 바인딩을 지원하는 Supabase SDK 사용
- 성공 시 저장된 행을 반환
- 클라이언트가 보낸 `id`, `created_at`을 신뢰하지 않는다. DB가 생성한다.

## 5. 피드백 조회 API
`GET /api/feedback?limit=20&offset=0`
- limit은 1~50 범위로 제한, 기본 20
- offset은 0 이상의 정수로 제한
- `created_at DESC` 정렬
- `limit + 1`개 조회 또는 동등한 방식으로 `hasMore` 계산
- 공개 응답에는 id, 표시 이름, content, createdAt만 포함
- name이 null/빈 값이면 displayName은 “익명”
- 페이지네이션은 중복/누락이 없도록 안정적인 정렬을 고려한다. 동시간 생성 가능성을 고려해 id를 보조 정렬 기준으로 둘 수 있다.

## 6. 스팸 및 악용 방지
- IP 기반 또는 플랫폼 호환 요청 제한을 적용한다. Vercel 인스턴스 메모리만을 영속 rate limiter로 간주하지 않는다.
- 외부 저장소 기반 제한이 없다면 기본 길이 제한과 간단한 제출 빈도 제어를 적용하고, 한계를 문서화한다.
- CAPTCHA, 관리자 검수, 신고 기능은 별도 요구가 없으므로 추가하지 않는다.
- 공개 피드백은 모든 방문자에게 보인다는 점을 UI에 짧게 안내한다.
- HTML 태그를 허용하지 않고 일반 텍스트로 저장/표시한다.

## 7. 완료/검증 기준
- SQL로 테이블과 인덱스 생성 가능
- 로그인 없이 피드백 제출 가능
- 저장된 피드백이 새로고침 후에도 조회됨
- 최신순 정렬
- 이름 생략 시 “익명”
- 2자 미만/1000자 초과 내용 차단
- 40자 초과 이름 차단
- 목록 빈 상태 및 DB 장애 상태 표시
- 공개 API에서 불필요한 개인정보가 노출되지 않음
- service role 키가 클라이언트에 노출되지 않음
