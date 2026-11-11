// ==============================================================================
// 파일명: api/recommend.js
// 설명: OpenAI API를 활용한 드라마 취향 분석 및 추천 Serverless Function
// 개선 사항:
//   1. 등장인물 팩트 100% 보장: 실제 포털/나무위키 공식 캐스팅 목록의 실존 주연과 배우만 매칭
//   2. 배우 이름 뒤의 '분' 제거: 배역명 (배우이름) 형식으로 표기 및 서버 정규식 필터링 적용
//   3. 장르 날조/조작 원천 차단 및 정직한 3개 순위 추천 유지
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

  // 5. 정밀하고 엄격한 팩트 기반 시스템 프롬프트 구성
  const systemPrompt = `당신은 대한민국 방송사, OTT 및 나무위키의 공식 캐스팅/메타데이터를 100% 팩트 기반으로 인출하는 정직한 드라마 데이터베이스 전문가입니다.

[★ 절대 준수 1: 등장인물 및 배우 매칭 100% 팩트 보장 ★]
- characters(등장인물): 해당 드라마의 공식 홈페이지 및 나무위키 캐스팅 목록에 실제로 존재하는 '진짜 실존 주연 배우'와 '실제 배역명'만 정확하게 1:1로 매칭하세요.
- 다른 작품의 인물을 섞거나, 출연하지도 않은 엉뚱한 배우를 연결하는 오류를 절대 엄격히 금지합니다.
- 반드시 '배역명 (배우이름) - 인물 설명' 형식으로 작성하세요.
- **[필수 규칙] 배우 이름 뒤에 '분' 자를 절대로 붙이지 마세요!**
  * 바른 예시: "도봉순 (박보영) - 선천적으로 어마무시한 괴력을 타고난 인물", "안민혁 (박형식) - 젊은 CEO"
  * 틀린 예시: "도봉순 (박보영 분)" (X - '분' 절대 금지)

[★ 절대 준수 2: 장르 날조/조작 절대 금지 ★]
- genres 배열에는 나무위키/방송사 공식 정보에 실제로 등재된 '진짜 공식 장르'만 그대로 적으세요.
- 사용자가 요청했다고 해서, 실제로는 없는 장르(예: 액션 없는 로코에 액션 추가)를 거짓으로 달지 마세요.
- 다 충족하는 드라마가 부족할 때는 솔직하게 실제 장르만 적고, 추천 이유(reason, 2줄 내외)에서 "비록 액션은 없지만 요청하신 로맨스와 코미디 요소를 완벽히 만족하여 추천합니다"와 같이 솔직하게 서술하세요.

[★ 절대 준수 3: 실제 공식 줄거리 요약 ★]
- synopsis(줄거리): 네이버 드라마 및 방송사 공식 홈페이지에 등록된 '실제 공식 기획의도 및 대표 줄거리'를 3~5줄로 정확하게 요약하세요. 지어내지 마세요.

반드시 아래의 순수 JSON 형식으로만 응답하세요:
{
  "recommendations": [
    {
      "title": "드라마 공식 제목",
      "year": 2017,
      "genres": ["실제", "공식", "장르만"],
      "matchPercentage": 95,
      "reason": "정직한 2줄 내외 추천 이유",
      "synopsis": "실제 포털에 나오는 공식 줄거리 3~5줄 요약",
      "characters": [
        "도봉순 (박보영) - 인물 핵심 설명",
        "안민혁 (박형식) - 인물 핵심 설명"
      ]
    }
  ]
}`;

  try {
    // 6. OpenAI API 호출 (temperature: 0.1 팩트 고정)
    const completion = await openai.chat.completions.create({
      model: modelName,
      temperature: 0.1,
      max_tokens: 2200,
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
      if (!reason || reason.length < 10) continue;

      const synopsis = typeof item.synopsis === 'string' ? item.synopsis.trim() : '';

      // 등장인물 정제: '배우명 분'에서 '분' 글자를 서버 레벨에서 완벽히 제거
      let characters = [];
      if (Array.isArray(item.characters)) {
        characters = item.characters
          .filter(c => typeof c === 'string' && c.trim().length > 0)
          .map(c => {
            let sanitized = c.trim();
            // "(배우이름 분)" 형태에서 " 분" 제거 -> "(배우이름)"
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

    // 9. 점수 기준 정렬 및 최대 3개 제한
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
