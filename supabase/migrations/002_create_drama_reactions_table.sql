-- ==============================================================================
-- 파일명: 002_create_drama_reactions_table.sql
-- 설명: 드라마별 누적 [좋아요] 및 [싫어요] 반응 저장을 위한 테이블 및 함수 스크립트
-- 작성 규칙: Supabase 쿼리 관리 규칙(000_ 접두사, supabase/migrations 폴더 관리) 준수
-- ==============================================================================

-- 1. drama_reactions (드라마 반응) 테이블 생성
-- 사용자들이 드라마 추천 결과에서 누른 좋아요와 싫어요 수를 작품명 기준으로 누적 저장합니다.
create table if not exists public.drama_reactions (
  -- drama_title: 작품 제목 (고유 식별 기본 키)
  drama_title text primary key,

  -- likes_count: 누적 좋아요 수 (기본값 0)
  likes_count integer not null default 0 check (likes_count >= 0),

  -- dislikes_count: 누적 싫어요 수 (기본값 0)
  dislikes_count integer not null default 0 check (dislikes_count >= 0),

  -- updated_at: 마지막으로 반응이 업데이트된 시각
  updated_at timestamptz not null default now()
);

-- 2. RLS (Row Level Security) 활성화
-- 외부의 비인가 직접 조작을 방지하고 백엔드 API를 통해서만 안전하게 집계되도록 합니다.
alter table public.drama_reactions enable row level security;

-- 3. 안전하고 정확한 동시성 카운트 증가를 위한 RPC 함수
-- 여러 사용자가 동시에 좋아요나 싫어요를 누를 때 숫자가 씹히지 않도록 데이터베이스 레벨에서 원자적으로 1 증가시킵니다.
create or replace function increment_drama_reaction(
  p_title text,
  p_action text
)
returns table (
  drama_title text,
  likes_count integer,
  dislikes_count integer
)
language plpgsql
security definer
as $$
begin
  -- 작품 데이터가 테이블에 없으면 0으로 먼저 생성(Upsert)
  insert into public.drama_reactions (drama_title, likes_count, dislikes_count, updated_at)
  values (p_title, 0, 0, now())
  on conflict (drama_title) do nothing;

  -- 액션 타입('like' 또는 'dislike')에 따라 카운트 1 증가
  if p_action = 'like' then
    update public.drama_reactions
    set likes_count = likes_count + 1,
        updated_at = now()
    where drama_reactions.drama_title = p_title;
  elsif p_action = 'dislike' then
    update public.drama_reactions
    set dislikes_count = dislikes_count + 1,
        updated_at = now()
    where drama_reactions.drama_title = p_title;
  end if;

  -- 업데이트된 최신 카운트 반환
  return query
  select r.drama_title, r.likes_count, r.dislikes_count
  from public.drama_reactions r
  where r.drama_title = p_title;
end;
$$;

