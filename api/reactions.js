// ==============================================================================
// 파일명: api/reactions.js
// 설명: 드라마별 누적 [좋아요] 및 [싫어요] 반응 조회(GET) 및 등록(POST) API
// 담당 역할:
//   1. GET: 특정 드라마 작품들의 누적 좋아요/싫어요 수 일괄 조회
//   2. POST: 특정 드라마의 좋아요 또는 싫어요 1 증가 및 최신 카운트 반환
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

export default async function handler(req, res) {
  // 1. Supabase 환경 변수 확인
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project-id')) {
    return res.status(500).json({
      error: {
        code: 'SERVER_CONFIG_ERROR',
        message: 'Supabase 설정이 올바르지 않습니다.'
      }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // ----------------------------------------------------------------------------
  // A. [GET] 드라마 작품들의 누적 반응 조회
  // ----------------------------------------------------------------------------
  if (req.method === 'GET') {
    const rawTitles = req.query.titles;
    if (!rawTitles || typeof rawTitles !== 'string') {
      return res.status(200).json({ reactions: {} });
    }

    const titles = rawTitles.split(',').map(t => t.trim()).filter(Boolean);
    if (titles.length === 0) {
      return res.status(200).json({ reactions: {} });
    }

    try {
      const { data, error } = await supabase
        .from('drama_reactions')
        .select('drama_title, likes_count, dislikes_count')
        .in('drama_title', titles);

      if (error) {
        return res.status(500).json({ error: { message: '반응 데이터를 조회하지 못했습니다.' } });
      }

      // 작품명을 key로 하는 객체로 변환
      const reactionMap = {};
      (data || []).forEach(row => {
        reactionMap[row.drama_title] = {
          likes: row.likes_count || 0,
          dislikes: row.dislikes_count || 0
        };
      });

      return res.status(200).json({ reactions: reactionMap });
    } catch {
      return res.status(500).json({ error: { message: '반응 데이터 조회 중 오류가 발생했습니다.' } });
    }
  }

  // ----------------------------------------------------------------------------
  // B. [POST] 드라마 좋아요/싫어요 증가
  // ----------------------------------------------------------------------------
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: { message: '올바른 JSON 요청이 아닙니다.' } });
      }
    }

    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const action = body?.action; // 'like' 또는 'dislike'

    if (!title || (action !== 'like' && action !== 'dislike')) {
      return res.status(400).json({
        error: { message: '작품명과 유효한 액션(like 또는 dislike)이 필요합니다.' }
      });
    }

    try {
      // 1) RPC 함수 호출 시도 (가장 안전한 원자적 증가)
      const { data: rpcData, error: rpcError } = await supabase.rpc('increment_drama_reaction', {
        p_title: title,
        p_action: action
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        const row = rpcData[0];
        return res.status(200).json({
          title: row.drama_title,
          likes: row.likes_count,
          dislikes: row.dislikes_count
        });
      }

      // 2) RPC 함수가 아직 실행되지 않았을 경우를 대비한 직접 Fallback 로직
      const { data: existing } = await supabase
        .from('drama_reactions')
        .select('drama_title, likes_count, dislikes_count')
        .eq('drama_title', title)
        .maybeSingle();

      let currentLikes = existing?.likes_count || 0;
      let currentDislikes = existing?.dislikes_count || 0;

      if (action === 'like') currentLikes += 1;
      if (action === 'dislike') currentDislikes += 1;

      const { data: upsertData, error: upsertError } = await supabase
        .from('drama_reactions')
        .upsert({
          drama_title: title,
          likes_count: currentLikes,
          dislikes_count: currentDislikes,
          updated_at: new Date().toISOString()
        })
        .select('drama_title, likes_count, dislikes_count')
        .single();

      if (upsertError || !upsertData) {
        return res.status(500).json({ error: { message: '반응을 저장하지 못했습니다.' } });
      }

      return res.status(200).json({
        title: upsertData.drama_title,
        likes: upsertData.likes_count,
        dislikes: upsertData.dislikes_count
      });

    } catch {
      return res.status(500).json({ error: { message: '서버 처리 중 오류가 발생했습니다.' } });
    }
  }

  // ----------------------------------------------------------------------------
  // C. 잘못된 메서드
  // ----------------------------------------------------------------------------
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: { message: '지원하지 않는 메서드입니다.' } });
}

