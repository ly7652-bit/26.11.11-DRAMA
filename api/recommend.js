// ==============================================================================
// 파일명: api/recommend.js
// 설명: OpenAI API를 활용한 드라마 취향 분석 및 추천 Serverless Function
// 개선 사항:
//   1. [★ 장르 날조/조작 원천 금지 ★] 나무위키 및 방송사 공식 등록된 실제 장르만 100% 그대로 기재
//   2. 사용자가 요구한 키워드에 맞추려고 없는 장르(예: 액션 없는 드라마에 액션 추가)를 억지로 끼워 넣는 행위 엄단
//   3. 조건에 완벽히 맞는 작품이 부족하여 대체 추천할 경우, 장르는 사실대로 표기하고 사유에서 정직하게 안내
//   4. temperature 0.1로 사실성 극대화 및 지어내기 완전 차단
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

  // 5. 정직한 팩트 기반 시스템 프롬프트 구성
  const systemPrompt = `당신은 대한민국 방송사, OTT 및 나무위키의 공식 메타데이터를 100% 팩트 기반으로 인출하는 정직한 드라마 데이터베이스 전문가입니다.

[★ 절대 준수 1: 장르 날조/조작 절대 금지 (100% 공식 사실만 기재) ★]
- genres 배열에는 나무위키 및 방송사 공식 정보에 실제로 등재되어 있는 **'진짜 공식 장르'만 그대로** 적으세요.
- 사용자가 "액션 로맨스 코미디"를 요청했다고 해서, **실제로는 액션 드라마가 아닌 작품(예: 순수 로코물 등)에 억지로 '액션' 장르를 거짓으로 집어넣는 행위를 절대 엄격히 금지합니다!**
- 다 충족하는 드라마가 부족하여 로맨틱 코미디 드라마를 추천한다면, 장르에는 실제 장르인 ["로맨틱 코미디"]만 정직하게 적으세요.
- 거짓 장르 태그를 절대 달지 마세요.

[★ 절대 준수 2: 정직한 3개 순위 추천 및 이유 설명 ★]
- 사용자가 복합 조건을 요구했을 때:
  1) 모든 조건을 충족하는 실제 드라마가 있다면 최우선 1위로 추천하세요. (예: 액션+로맨스+코미디 -> '힘쎈여자 도봉순' 등)
  2) 모든 조건을 만족하는 실존 명작이 부족하다면, 거짓말하지 말고 요구조건 중 일부(예: 로맨스+코미디)를 확실하게 만족하는 실존 작품들을 차순위(2위, 3위)로 채워 **총 3개**를 추천하세요.
  3) 추천 이유(reason, 2줄 내외)에서도 솔직하게 서술하세요. (예: "액션 요소는 없지만, 요청하신 로맨스와 코미디 요소를 최고 수준으로 만끽할 수 있는 대표작입니다.")

[★ 절대 준수 3: 실제 공식 줄거리와 실존 배역 팩트만 기재 ★]
- synopsis(줄거리): 네이버 드라마 및 방송사 공식 홈페이지에 등록된 '실제 공식 기획의도 및 대표 줄거리'를 3~5줄로 정확하게 요약하세요. 절대로 없는 이야기를 지어내지 마세요.
- characters(등장인물): 해당 작품에 실제로 출연한 주요 배역명과 배우명을 정확히 기재하세요. (예: "안민혁 (박형식 분) - 게임회사 아인소프트의 대표")

반드시 아래의 순수 JSON 형식으로만 응답하세요:
{
  "recommendations": [
    {
      "title": "드라마 공식 제목",
      "year": 2017,
      "genres": ["실제", "공식", "장르만"],
      "matchPercentage": 92,
      "reason": "솔직하고 명확한 2줄 내외 추천 이유",
      "synopsis": "실제 포털에 나오는 공식 줄거리 3~5줄 요약",
      "characters": [
        "실제배역 (실제배우) - 인물 설명"
      ]
    }
  ]
}`;

  try {
    // 6. OpenAI API 호출 (temperature: 0.1 극단적 팩트 모드)
    const completion = await openai.chat.completions.create({
      model: modelName,
      temperature: 0.1, // 창작/지어내기/장르조작 완전 차단 (팩트 고정)
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

      let characters = [];
      if (Array.isArray(item.characters)) {
        characters = item.characters
          .filter(c => typeof c === 'string' && c.trim().length > 0)
          .map(c => c.trim())
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
