// ==============================================================================
// 파일명: api/feedback/index.js
// 설명: Supabase를 연동한 익명 피드백 등록(POST) 및 목록 조회(GET) Serverless Function
// 담당 역할:
//   1. GET: 최신순 피드백 목록 페이징 조회 (기본 20개, hasMore 지원)
//   2. POST: 피드백 등록 (이름: 선택 최대 40자, 내용: 필수 2~1000자)
//   3. 보안: 서버 전용 service_role 키를 사용하며 브라우저에 키 노출 차단
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

export default async function handler(req, res) {
  // 1. Supabase 환경 변수 확인
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !supabaseServiceKey ||
    supabaseUrl.includes('your-project-id') ||
    supabaseServiceKey.includes('your_supabase_service_role_key_here')
  ) {
    return res.status(500).json({
      error: {
        code: 'SERVER_CONFIG_ERROR',
        message: 'Supabase 데이터베이스 연결 정보가 올바르게 설정되지 않았습니다. .env 파일을 확인해 주세요.'
      }
    });
  }

  // Supabase 서버 전용 클라이언트 인스턴스 생성
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  // ----------------------------------------------------------------------------
  // A. [GET] 피드백 목록 조회 API
  // ----------------------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      // 쿼리 스트링 파싱 (기본 limit=20, offset=0)
      const limitQuery = parseInt(req.query.limit, 10);
      const offsetQuery = parseInt(req.query.offset, 10);

      const limit = Number.isInteger(limitQuery) && limitQuery >= 1 && limitQuery <= 50 ? limitQuery : 20;
      const offset = Number.isInteger(offsetQuery) && offsetQuery >= 0 ? offsetQuery : 0;

      // 다음 페이지 존재 여부(hasMore) 확인을 위해 limit + 1개를 조회합니다.
      const fetchCount = limit + 1;

      const { data, error } = await supabase
        .from('feedback')
        .select('id, name, content, created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + fetchCount - 1);

      if (error) {
        return res.status(500).json({
          error: {
            code: 'DATABASE_ERROR',
            message: '피드백 목록을 불러오는 중 데이터베이스 오류가 발생했습니다.'
          }
        });
      }

      const rows = data || [];
      const hasMore = rows.length > limit;
      const items = (hasMore ? rows.slice(0, limit) : rows).map(row => ({
        id: row.id,
        displayName: row.name && row.name.trim() ? row.name.trim() : '익명',
        content: row.content,
        createdAt: row.created_at
      }));

      return res.status(200).json({
        items,
        hasMore
      });

    } catch {
      return res.status(500).json({
        error: {
          code: 'DATABASE_ERROR',
          message: '피드백 목록을 조회하지 못했습니다.'
        }
      });
    }
  }

  // ----------------------------------------------------------------------------
  // B. [POST] 익명 피드백 등록 API
  // ----------------------------------------------------------------------------
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          error: {
            code: 'INVALID_JSON',
            message: '유효한 JSON 형식이 아닙니다.'
          }
        });
      }
    }

    const rawName = body?.name;
    const rawContent = body?.content;

    // 이름(name) 검증: 선택 사항, 최대 40자, 빈 값은 null 처리
    let name = null;
    if (typeof rawName === 'string') {
      const trimmedName = rawName.trim();
      if (trimmedName.length > 40) {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: '작성자 이름은 최대 40자까지 입력 가능합니다.'
          }
        });
      }
      if (trimmedName.length > 0) {
        name = trimmedName;
      }
    }

    // 내용(content) 검증: 필수 사항, trim 후 2~1000자
    if (typeof rawContent !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: '피드백 내용은 필수 텍스트 항목입니다.'
        }
      });
    }

    const trimmedContent = rawContent.trim();
    if (trimmedContent.length < 2 || trimmedContent.length > 1000) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: '피드백 내용은 최소 2자 이상, 최대 1000자 이하로 작성해 주세요.'
        }
      });
    }

    try {
      // Supabase 테이블에 새로운 피드백 행 삽입
      const { data, error } = await supabase
        .from('feedback')
        .insert([
          {
            name: name,
            content: trimmedContent
          }
        ])
        .select('id, name, content, created_at')
        .single();

      if (error || !data) {
        return res.status(500).json({
          error: {
            code: 'DATABASE_ERROR',
            message: '피드백을 저장하는 중 오류가 발생했습니다.'
          }
        });
      }

      return res.status(201).json({
        id: data.id,
        displayName: data.name && data.name.trim() ? data.name.trim() : '익명',
        content: data.content,
        createdAt: data.created_at
      });

    } catch {
      return res.status(500).json({
        error: {
          code: 'DATABASE_ERROR',
          message: '피드백 저장 중 서버 오류가 발생했습니다.'
        }
      });
    }
  }

  // ----------------------------------------------------------------------------
  // C. 허용되지 않은 HTTP 메서드 처리
  // ----------------------------------------------------------------------------
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: '지원하지 않는 HTTP 메서드입니다. (GET 또는 POST만 가능)'
    }
  });
}

