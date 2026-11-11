// ==============================================================================
// 파일명: public/js/api.js
// 설명: 백엔드 Serverless API와의 통신을 담당하는 모듈
// 담당 역할:
//   1. 드라마 추천 요청 (POST /api/recommend)
//   2. 피드백 목록 페이징 조회 (GET /api/feedback)
//   3. 피드백 작성 제출 (POST /api/feedback)
//   4. 드라마 누적 좋아요/싫어요 조회 (GET /api/reactions) 및 등록 (POST /api/reactions)
// ==============================================================================

/**
 * 드라마 취향 추천을 서버에 요청합니다.
 * @param {string} preference 
 * @returns {Promise<{ recommendations: Array, notice: string }>}
 */
export async function requestRecommendations(preference) {
  try {
    const response = await fetch('/api/recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ preference })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = data?.error?.message || '추천 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('서버와 통신할 수 없습니다. 인터넷 연결 또는 로컬 서버 상태를 확인해 주세요.');
    }
    throw error;
  }
}

/**
 * 피드백 목록을 서버에서 조회합니다.
 * @param {number} limit 
 * @param {number} offset 
 * @returns {Promise<{ items: Array, hasMore: boolean }>}
 */
export async function fetchFeedbackList(limit = 20, offset = 0) {
  try {
    const response = await fetch(`/api/feedback?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = data?.error?.message || '피드백 목록을 가져오지 못했습니다.';
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('피드백 서버에 연결할 수 없습니다.');
    }
    throw error;
  }
}

/**
 * 새로운 피드백을 서버에 등록합니다.
 * @param {string} name 
 * @param {string} content 
 * @returns {Promise<{ id: string, displayName: string, content: string, createdAt: string }>}
 */
export async function submitFeedback(name, content) {
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, content })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = data?.error?.message || '피드백 등록에 실패했습니다.';
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('서버와 통신할 수 없습니다.');
    }
    throw error;
  }
}

/**
 * 드라마들의 누적 좋아요/싫어요 반응 수를 조회합니다.
 * @param {string[]} titles 
 * @returns {Promise<{ reactions: Object }>}
 */
export async function fetchReactions(titles) {
  if (!titles || titles.length === 0) return { reactions: {} };
  try {
    const query = encodeURIComponent(titles.join(','));
    const response = await fetch(`/api/reactions?titles=${query}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const data = await response.json().catch(() => null);
    return data || { reactions: {} };
  } catch {
    return { reactions: {} };
  }
}

/**
 * 특정 드라마에 좋아요 또는 싫어요를 전송합니다.
 * @param {string} title 
 * @param {'like' | 'dislike'} action 
 * @returns {Promise<{ title: string, likes: number, dislikes: number }>}
 */
export async function sendReaction(title, action) {
  try {
    const response = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, action })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error?.message || '반응 처리에 실패했습니다.');
    }
    return data;
  } catch (error) {
    throw error;
  }
}
