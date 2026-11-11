-- ==============================================================================
-- 파일명: 001_create_feedback_table.sql
-- 설명: 드라마 추천 서비스의 '익명 피드백' 저장을 위한 feedback 테이블 생성 스크립트
-- 작성 규칙: Supabase 쿼리 관리 규칙(000_ 접두사, supabase/migrations 폴더 관리) 준수
-- ==============================================================================

-- 1. UUID 생성을 위한 pgcrypto 확장 모듈 활성화
-- (고유 식별자 생성을 위해 gen_random_uuid() 함수를 사용합니다)
create extension if not exists pgcrypto;

-- 2. feedback (피드백) 테이블 생성
-- 사용자가 남긴 소중한 피드백을 안전하게 저장하는 테이블입니다.
create table if not exists public.feedback (
  -- id: 각 피드백을 고유하게 식별하는 기본 키 (UUID 자동 생성)
  id uuid primary key default gen_random_uuid(),

  -- name: 작성자 이름 (선택 항목)
  -- 이름이 없는 경우(null)를 허용하며, 입력 시 최대 40자까지 허용합니다.
  name text null check (name is null or char_length(name) <= 40),

  -- content: 피드백 내용 (필수 항목)
  -- 앞뒤 공백을 제외하고 최소 2자 이상, 최대 1000자까지 저장할 수 있도록 검증(check)합니다.
  content text not null check (char_length(trim(content)) between 2 and 1000),

  -- created_at: 피드백이 등록된 시각 (기본값으로 현재 시간 now() 자동 기록)
  created_at timestamptz not null default now()
);

-- 3. 최신순 조회를 위한 인덱스 생성
-- 사용자가 등록한 피드백을 최신순(created_at 내림차순)으로 빠르게 조회할 수 있도록 인덱스를 추가합니다.
create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

-- 4. RLS (Row Level Security, 행 단위 보안) 활성화
-- 데이터베이스 보안을 위해 RLS를 활성화합니다.
-- 본 서비스는 브라우저가 직접 DB에 접근하지 않고, 백엔드 서버(Node.js Vercel Function)가
-- 안전하게 service_role 키를 통해서만 조회/저장을 수행하므로 외부에서의 직접적인 무단 조작을 원천 차단합니다.
alter table public.feedback enable row level security;

