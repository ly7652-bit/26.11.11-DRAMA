// ==============================================================================
// 파일명: api/recommend.js
// 설명: OpenAI API를 활용한 드라마 취향 분석 및 추천 Serverless Function (고도화 버전)
// 개선 사항:
//   1. 사용자가 요청한 장르와 실제 작품의 공인 장르 일치도 강력 강화
//   2. 추천 이유를 핵심만 2줄 내외로 요약
//   3. 실제 드라마 줄거리 (3~5줄 요약) 추가
//   4. 주요 등장인물 및 배역 설명 (characters) 추가
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
    timeout: 35000 // 35초 타임아웃
  });

  const currentYear = new Date().getFullYear();

  // 5. 대폭 고도화된 AI 시스템 프롬프트 구성
  const systemPrompt = `당신은 사용자의 취향을 정밀하게 분석하여 최고의 드라마를 추천하는 대한민국 최고의 드라마 큐레이터 전문가입니다.

[★ 최우선 필수 규칙: 장르 일치도 철저 보장 ★]
1. 사용자가 원하는 장르(예: 범죄, 스릴러, 로맨스, SF, 사극, 코미디, 판타지 등)와 분위기를 정확히 파악하세요.
2. 실제로 공식 방영 및 등록된 공식 장르 분류에 사용자가 원하는 핵심 장르가 **반드시 포함되어 있는 실존 드라마만** 추천하세요.
3. 사용자가 요청하지 않은 엉뚱한 장르나 다른 분위기의 드라마를 절대 추천하지 마세요. (예: 범죄 스릴러를 요청했는데 단순 멜로 드라마를 추천하는 등의 오류 엄금)
4. 반드시 실제로 방영된 실존 드라마만 추천하며, 존재하지 않는 가상의 작품명을 절대 지어내지 마세요.

[상세 출력 정보 규칙]
- recommendations: 최대 3개 (1위~3위). 조건에 맞는 훌륭한 작품만 추천하며 억지로 채우지 마세요.
- matchPercentage(0~100 정수): 후보 드라마 사이의 상대적인 취향 적합도(매칭 점수)입니다.
- reason(추천 이유): **정확히 2줄 내외**로 핵심만 간결하고 명확하게 작성하세요. 사용자의 취향 요구사항과 작품의 일치 포인트를 요약합니다.
- synopsis(줄거리 요약): **반드시 3줄에서 5줄 사이**로, 결말 스포일러 없이 작품의 도입부 갈등과 핵심 사건 전개를 흥미진진하게 요약하세요.
- characters(주요 등장인물): 드라마의 중심이 되는 핵심 배역 2~3명을 배열로 제공하세요. 형식: "배역명 (배우명) - 인물의 핵심 특징 및 역할 설명"
- genres: 실제 공식 장르 최대 4개 한국어 단어 배열.

반드시 아래의 순수 JSON 형식으로만 응답하세요:
{
  "recommendations": [
    {
      "title": "드라마 공식 명칭",
      "year": 2021,
      "genres": ["범죄", "스릴러", "미스터리"],
      "matchPercentage": 96,
      "reason": "요청하신 치밀한 두뇌 싸움과 충격적인 반전 요소를 모두 갖춘 웰메이드 스릴러입니다.\\n답답함 없는 빠른 전개와 긴장감 넘치는 연출이 취향에 완벽히 부합합니다.",
      "synopsis": "바른 청년으로 살아가던 순경 정바름이 사이코패스 연쇄살인마와 마주치며 시작되는 이야기입니다.\\n희대의 프레데터 살인범을 쫓는 과정에서 감춰졌던 잔혹한 진실들이 하나둘씩 드러납니다.\\n인간의 뇌와 사이코패스 유전자를 둘러싼 충격적인 사건들이 예측 불가능하게 휘몰아칩니다.",
      "characters": [
        "정바름 (이승기 분) - 정의감 넘치는 파출소 순경이었으나 일련의 사건 후 변화를 겪는 인물",
        "고무치 (이희준 분) - 부모를 죽인 살인마에게 복수하기 위해 형사가 된 강력계 형사"
      ]
    }
  ]
}`;

  try {
    // 6. OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: modelName,
      temperature: 0.6,
      max_tokens: 2000,
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

      // 제목 검증
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!title || title.length < 1 || title.length > 120) continue;

      const normalizedTitleKey = title.toLowerCase().replace(/\s+/g, '');
      if (seenTitles.has(normalizedTitleKey)) continue;
      seenTitles.add(normalizedTitleKey);

      // 연도 검증
      let year = null;
      if (Number.isInteger(item.year) && item.year >= 1900 && item.year <= currentYear + 2) {
        year = item.year;
      }

      // 장르 검증
      let genres = [];
      if (Array.isArray(item.genres)) {
        genres = item.genres
          .filter(g => typeof g === 'string' && g.trim().length >= 1 && g.trim().length <= 30)
          .map(g => g.trim())
          .slice(0, 5);
      }

      // 점수 검증 (0~100)
      let matchPercentage = 0;
      if (typeof item.matchPercentage === 'number' && !isNaN(item.matchPercentage)) {
        matchPercentage = Math.round(Math.max(0, Math.min(100, item.matchPercentage)));
      }

      // 2줄 추천 사유 검증
      const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
      if (!reason || reason.length < 10) continue;

      // 줄거리 (3~5줄 요약) 검증
      const synopsis = typeof item.synopsis === 'string' ? item.synopsis.trim() : '';

      // 주요 등장인물 검증
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
