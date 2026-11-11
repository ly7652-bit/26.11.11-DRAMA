// ==============================================================================
// 파일명: api/recommend.js
// 설명: OpenAI API를 활용한 드라마 취향 분석 및 추천 Serverless Function
// 핵심 수정:
//   1. [★ 무조건 3개 추천 강제 ★] 1~2개 출력 절대 금지, 반드시 1위~3위 3개 작품 완벽 반환
//   2. 핑계성 부정 문구("~는 없지만") 완전 제거 및 실제 해당 장르 명작 엄선
//   3. 공식 장르 팩트 유지 및 배우 이름 뒤 '분' 완전 제거
// ==============================================================================

import OpenAI from 'openai';
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

  // 2. 환경 변수 확인
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
    timeout: 35000
  });

  const currentYear = new Date().getFullYear();

  // 5. 정확하고 엄격한 시스템 프롬프트 구성
  const systemPrompt = `당신은 대한민국 방송사, OTT 및 나무위키의 데이터베이스를 기반으로 작동하는 국내 최고의 드라마 전문 큐레이터입니다.

[★ 최우선 규칙 1: 무조건 3개의 드라마 추천 필수 (recommendations.length === 3) ★]
- recommendations 배열에는 **반드시 3개의 서로 다른 실존 드라마 객체**를 포함해야 합니다.
- 1개나 2개만 추천하는 것은 절대 금지입니다. 사용자의 취향에 가장 잘 부합하는 실존 웰메이드 명작 드라마 3개를 엄선하여 1위, 2위, 3위로 채우세요.

[★ 최우선 규칙 2: 사용자가 원하는 장르 요소 적극 반영 & 긍정적 추천 이유 ★]
- 사용자가 여러 장르를 요구한 경우(예: 액션 + 로맨스 + 코미디):
  * 실제로 그 요소들(통쾌한 액션, 달달한 로맨스, 유쾌한 코미디)이 잘 어우러진 실존 대표작들(예: 힘쎈여자 도봉순, 빈센조, 열혈사제, 힐러, 너의 목소리가 들려, 무빙 등)을 적극 선별하세요.
  * reason(추천 이유): **정확히 2줄 내외**로, 해당 작품이 사용자가 요청한 재미 요소를 어떻게 만족시켜 주는지 실제 매력을 긍정적이고 명쾌하게 요약하세요. 절대로 "~는 없지만" 같은 부정적인 핑계 문구를 쓰지 마세요!

[★ 최우선 규칙 3: 실제 공식 장르 및 실존 줄거리/등장인물 팩트 보장 ★]
- genres: 나무위키 및 방송사 공식 정보에 기재된 실제 공식 장르 목록을 그대로 적으세요. 없는 장르를 날조하지 마세요.
- synopsis: 방송사/네이버에 등록된 '실제 공식 기획의도 및 대표 줄거리'를 3~5줄로 정확하게 요약하세요.
- characters: 해당 작품에 실제로 출연한 주요 배역과 배우명을 정확하게 작성하세요.
  * 형식: "배역명 (배우이름) - 인물 설명"
  * **[주의] 배우 이름 뒤에 절대로 '분' 자를 붙이지 마세요!** (예: "도봉순 (박보영) - 인물 설명")

반드시 아래의 순수 JSON 형식으로 정확히 3개 작품을 응답하세요:
{
  "recommendations": [
    {
      "title": "1위 드라마 제목",
      "year": 2017,
      "genres": ["실제공식장르1", "실제공식장르2"],
      "matchPercentage": 96,
      "reason": "1위 추천 이유 1줄\\n1위 추천 이유 2줄",
      "synopsis": "실제 공식 줄거리 3~5줄 요약",
      "characters": [
        "배역명 (배우명) - 인물 설명",
        "배역명 (배우명) - 인물 설명"
      ]
    },
    {
      "title": "2위 드라마 제목",
      "year": 2021,
      "genres": ["실제공식장르1", "실제공식장르2"],
      "matchPercentage": 90,
      "reason": "2위 추천 이유 1줄\\n2위 추천 이유 2줄",
      "synopsis": "실제 공식 줄거리 3~5줄 요약",
      "characters": [
        "배역명 (배우명) - 인물 설명",
        "배역명 (배우명) - 인물 설명"
      ]
    },
    {
      "title": "3위 드라마 제목",
      "year": 2014,
      "genres": ["실제공식장르1", "실제공식장르2"],
      "matchPercentage": 85,
      "reason": "3위 추천 이유 1줄\\n3위 추천 이유 2줄",
      "synopsis": "실제 공식 줄거리 3~5줄 요약",
      "characters": [
        "배역명 (배우명) - 인물 설명",
        "배역명 (배우명) - 인물 설명"
      ]
    }
  ]
}`;

  try {
    // 6. OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: modelName,
      temperature: 0.1, // 팩트 고정
      max_tokens: 2500,
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

      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!title || title.length < 1 || title.length > 120) continue;

      const normalizedTitleKey = title.toLowerCase().replace(/\s+/g, '');
      if (seenTitles.has(normalizedTitleKey)) continue;
      seenTitles.add(normalizedTitleKey);

      let year = null;
      if (Number.isInteger(item.year) && item.year >= 1900 && item.year <= currentYear + 2) {
        year = item.year;
      }

      let genres = [];
      if (Array.isArray(item.genres)) {
        genres = item.genres
          .filter(g => typeof g === 'string' && g.trim().length >= 1 && g.trim().length <= 30)
          .map(g => g.trim())
          .slice(0, 5);
      }

      let matchPercentage = 0;
      if (typeof item.matchPercentage === 'number' && !isNaN(item.matchPercentage)) {
        matchPercentage = Math.round(Math.max(0, Math.min(100, item.matchPercentage)));
      }

      const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
      if (!reason || reason.length < 5) continue;

      const synopsis = typeof item.synopsis === 'string' ? item.synopsis.trim() : '';

      // 배우명 뒤 '분' 완벽 제거 정규식
      let characters = [];
      if (Array.isArray(item.characters)) {
        characters = item.characters
          .filter(c => typeof c === 'string' && c.trim().length > 0)
          .map(c => {
            let sanitized = c.trim();
            sanitized = sanitized.replace(/\s*분\s*\)/g, ')');
            return sanitized;
          })
          .slice(0, 4);
      }

      validatedRecommendations.push({
        title,
        year,
        genres,
        matchPercentage,
        reason,
        synopsis,
        characters
      });
    }

    // 9. 점수 기준 내림차순 정렬 및 최대 3개 순위 부여
    validatedRecommendations.sort((a, b) => b.matchPercentage - a.matchPercentage);

    const finalResults = validatedRecommendations.slice(0, 3).map((item, index) => ({
      rank: index + 1,
      title: item.title,
      year: item.year,
      genres: item.genres,
      matchPercentage: item.matchPercentage,
      reason: item.reason,
      synopsis: item.synopsis,
      characters: item.characters
    }));

    // 10. 최종 결과 응답
    return res.status(200).json({
      recommendations: finalResults,
      notice: '매칭 백분율은 후보 드라마 사이의 상대적인 취향 적합도(매칭 점수)이며, 절대적인 시청 만족도나 확률이 아닙니다.'
    });

  } catch (err) {
    if (err?.name === 'AbortError' || err?.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: {
          code: 'AI_TIMEOUT',
          message: 'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
        }
      });
    }

    if (err?.status === 429) {
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'
        }
      });
    }

    return res.status(502).json({
      error: {
        code: 'AI_PROVIDER_ERROR',
        message: '추천 서비스를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.'
      }
    });
  }
}
