// ==============================================================================
// 파일명: api/recommend.js
// 설명: OpenAI API를 활용한 드라마 취향 분석 및 추천 Serverless Function
// 담당 역할: 
//   1. 클라이언트 요청 유효성 검사 (5~500자)
//   2. OpenAI API 연동 및 JSON 응답 파싱
//   3. AI 응답 스키마/점수 범위 검증 및 중복 작품 제거
//   4. 순위 정렬(최대 3개) 후 안전한 JSON 반환
// ==============================================================================

import OpenAI from 'openai';

// 환경 변수 설정 (로컬 환경을 위한 dotenv 처리 포함)
import 'dotenv/config';

export default async function handler(req, res) {
  // 1. HTTP 메서드 검증 (POST 요청만 허용)
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'POST 요청만 지원합니다.'
      }
    });
  }

  // 2. 환경 변수 확인 (OpenAI API 키 누락 시 안전한 500 에러 처리)
  const apiKey = process.env.OPENAI_API_KEY;
  const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_openai_api_key_here')) {
    return res.status(500).json({
      error: {
        code: 'SERVER_CONFIG_ERROR',
        message: '서버에 OpenAI API 키가 설정되지 않았습니다. .env 파일을 확인해 주세요.'
      }
    });
  }

  // 3. 요청 본문(body) 검증
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

  const preference = body?.preference;

  // 입력값 검증: 문자열 타입 여부 확인 및 공백 제거 후 5~500자 제한
  if (typeof preference !== 'string') {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: '취향 입력값(preference)은 문자열이어야 합니다.'
      }
    });
  }

  const trimmedPreference = preference.trim();
  if (trimmedPreference.length < 5 || trimmedPreference.length > 500) {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: '취향 설명은 공백 제외 최소 5자 이상, 최대 500자 이하로 입력해 주세요.'
      }
    });
  }

  // 4. OpenAI 클라이언트 인스턴스 생성
  const openai = new OpenAI({
    apiKey: apiKey,
    timeout: 30000 // 30초 타임아웃 설정
  });

  // 현재 연도 계산 (유효한 방영 연도 검증용)
  const currentYear = new Date().getFullYear();

  // 5. AI 시스템 프롬프트 구성 (AGENTS.md 및 PRD.md 지침 준수)
  const systemPrompt = `당신은 사용자의 취향을 정밀하게 분석하여 최고의 드라마를 추천하는 드라마 큐레이터 전문가입니다.
사용자의 입력을 장르, 분위기, 소재, 전개 속도, 감정 톤 관점에서 분석하고, 가장 잘 부합하는 실제 존재하는 드라마를 최대 3개 추천하세요.

[엄격한 추천 및 출력 규칙]
1. 반드시 실제로 제작 및 방영된 실존 드라마만 추천하세요. 허구의 작품명을 절대 지어내지 마세요.
2. 작품명이나 연도를 확신할 수 없으면 추천에서 제외하거나 연도를 null로 설정하세요.
3. 추천 순위는 최대 3개(1위~3위)입니다. 어울리는 드라마가 적다면 1~2개만 반환해도 되며 억지로 채우지 마세요.
4. matchPercentage(0~100 정수): 객관적인 시청 성공률이나 확률이 아니라, 후보 드라마 사이의 '상대적인 취향 적합도(매칭 점수)'입니다. 가장 잘 맞는 1위 작품을 기준으로 적절한 점수를 부여하세요.
5. reason(추천 이유): 20자 이상 500자 이하의 친절하고 명확한 한국어로 작성하세요. 사용자가 입력한 취향 키워드/분위기와 작품의 핵심 특징을 연결하여 구체적으로 설득력 있게 설명하세요.
6. genres: 장르를 최대 5개까지 한국어 단어 배열로 제공하세요.
7. 반드시 아래의 순수 JSON 형식으로만 응답하고, 마크다운 코드블록(\`\`\`json 등)이나 기타 텍스트를 절대 붙이지 마세요.

JSON 응답 스키마:
{
  "recommendations": [
    {
      "title": "작품 제목 (한국어 공식 명칭 우선)",
      "year": 2022,
      "genres": ["범죄", "스릴러"],
      "matchPercentage": 95,
      "reason": "사용자님이 요청하신 어두운 분위기와 빠른 반전 요소를 모두 갖춘 작품으로..."
    }
  ]
}`;

  try {
    // 6. OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: modelName,
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: trimmedPreference }
      ]
    });

    const aiMessageContent = completion.choices?.[0]?.message?.content;
    if (!aiMessageContent) {
      return res.status(502).json({
        error: {
          code: 'AI_PROVIDER_ERROR',
          message: 'AI 서비스로부터 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.'
        }
      });
    }

    // 7. AI 응답 JSON 파싱
    let parsedData;
    try {
      parsedData = JSON.parse(aiMessageContent);
    } catch {
      return res.status(500).json({
        error: {
          code: 'AI_RESPONSE_INVALID',
          message: 'AI 응답 데이터 형식이 올바르지 않습니다.'
        }
      });
    }

    const rawList = Array.isArray(parsedData.recommendations) ? parsedData.recommendations : [];

    // 8. 서버 측 스키마 검증 및 데이터 정제
    const validatedRecommendations = [];
    const seenTitles = new Set();

    for (const item of rawList) {
      if (!item || typeof item !== 'object') continue;

      // 제목 검증 (1~120자)
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!title || title.length < 1 || title.length > 120) continue;

      // 중복 작품명 제거 (소문자 및 띄어쓰기 정규화 기준)
      const normalizedTitleKey = title.toLowerCase().replace(/\s+/g, '');
      if (seenTitles.has(normalizedTitleKey)) continue;
      seenTitles.add(normalizedTitleKey);

      // 연도 검증 (1900년 ~ 현재연도+2년 이내의 정수 또는 null)
      let year = null;
      if (Number.isInteger(item.year) && item.year >= 1900 && item.year <= currentYear + 2) {
        year = item.year;
      }

      // 장르 검증 (최대 5개, 각 1~30자)
      let genres = [];
      if (Array.isArray(item.genres)) {
        genres = item.genres
          .filter(g => typeof g === 'string' && g.trim().length >= 1 && g.trim().length <= 30)
          .map(g => g.trim())
          .slice(0, 5);
      }

      // 매칭 점수 검증 (0~100 정수)
      let matchPercentage = 0;
      if (typeof item.matchPercentage === 'number' && !isNaN(item.matchPercentage)) {
        matchPercentage = Math.round(Math.max(0, Math.min(100, item.matchPercentage)));
      }

      // 추천 사유 검증 (20~500자)
      const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
      if (reason.length < 20 || reason.length > 500) continue;

      validatedRecommendations.push({
        title,
        year,
        genres,
        matchPercentage,
        reason
      });
    }

    // 9. 점수 기준 내림차순 정렬 (동점일 경우 AI가 반환한 원래 순서 유지)
    validatedRecommendations.sort((a, b) => b.matchPercentage - a.matchPercentage);

    // 최대 3개로 제한하고 1~3위 순위(rank) 부여
    const finalResults = validatedRecommendations.slice(0, 3).map((item, index) => ({
      rank: index + 1,
      title: item.title,
      year: item.year,
      genres: item.genres,
      matchPercentage: item.matchPercentage,
      reason: item.reason
    }));

    // 10. 최종 결과 응답
    return res.status(200).json({
      recommendations: finalResults,
      notice: '매칭 백분율은 후보 드라마 사이의 상대적인 취향 적합도(매칭 점수)이며, 절대적인 시청 만족도나 확률이 아닙니다.'
    });

  } catch (err) {
    // 타임아웃 에러 처리
    if (err?.name === 'AbortError' || err?.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: {
          code: 'AI_TIMEOUT',
          message: 'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
        }
      });
    }

    // 요청 제한(Rate Limit) 초과 처리
    if (err?.status === 429) {
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'
        }
      });
    }

    // 기타 OpenAI API 에러 처리 (민감한 시스템 키나 원문은 숨김)
    return res.status(502).json({
      error: {
        code: 'AI_PROVIDER_ERROR',
        message: '추천 서비스를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.'
      }
    });
  }
}

