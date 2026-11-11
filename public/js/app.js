// ==============================================================================
// 파일명: public/js/app.js
// 설명: 드라마 추천 서비스의 메인 프론트엔드 제어 컨트롤러 (고도화 버전)
// 담당 역할:
//   1. 취향 추천 폼 및 피드백 폼 이벤트 처리
//   2. 추천 결과 렌더링 및 누적 [좋아요/싫어요] 실시간 조회 & 집계 반영
//   3. 중복 클릭 방지 및 상태 관리 (로딩/오류/빈 결과)
// ==============================================================================

import { validatePreference, validateFeedback } from './validation.js';
import { requestRecommendations, fetchFeedbackList, submitFeedback, fetchReactions, sendReaction } from './api.js';
import { createRecommendationCard, createFeedbackCard } from './render.js';

document.addEventListener('DOMContentLoaded', () => {
  // ----------------------------------------------------------------------------
  // 1. DOM 요소 참조 획득
  // ----------------------------------------------------------------------------
  
  // 취향 추천 관련 요소
  const recommendForm = document.getElementById('recommend-form');
  const preferenceInput = document.getElementById('preference-input');
  const charCounter = document.getElementById('char-counter');
  const preferenceError = document.getElementById('preference-error');
  const recommendBtn = document.getElementById('recommend-btn');
  const recommendBtnText = recommendBtn.querySelector('.btn-text');
  const recommendBtnLoading = recommendBtn.querySelector('.btn-loading-text');

  const resultsSection = document.getElementById('results-section');
  const resultsList = document.getElementById('results-list');
  const resultsStatus = document.getElementById('results-status');

  // 피드백 관련 요소
  const feedbackForm = document.getElementById('feedback-form');
  const feedbackName = document.getElementById('feedback-name');
  const feedbackContent = document.getElementById('feedback-content');
  const feedbackCharCounter = document.getElementById('feedback-char-counter');
  const feedbackNameError = document.getElementById('feedback-name-error');
  const feedbackContentError = document.getElementById('feedback-content-error');
  const feedbackBtn = document.getElementById('feedback-btn');
  const feedbackBtnText = feedbackBtn.querySelector('.btn-text');
  const feedbackBtnLoading = feedbackBtn.querySelector('.btn-loading-text');

  const feedbackList = document.getElementById('feedback-list');
  const feedbackStatus = document.getElementById('feedback-status');
  const loadMoreBtn = document.getElementById('load-more-feedback-btn');

  let feedbackOffset = 0;
  const FEEDBACK_LIMIT = 20;

  // ----------------------------------------------------------------------------
  // 2. 글자 수 카운터 및 키보드 입력 핸들러
  // ----------------------------------------------------------------------------

  preferenceInput.addEventListener('input', () => {
    const currentLength = preferenceInput.value.length;
    charCounter.textContent = `${currentLength} / 500`;
    if (preferenceError.textContent) {
      preferenceError.textContent = '';
    }
  });

  preferenceInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      recommendForm.requestSubmit();
    }
  });

  feedbackContent.addEventListener('input', () => {
    const currentLength = feedbackContent.value.length;
    feedbackCharCounter.textContent = `${currentLength} / 1000`;
    if (feedbackContentError.textContent) {
      feedbackContentError.textContent = '';
    }
  });

  feedbackName.addEventListener('input', () => {
    if (feedbackNameError.textContent) {
      feedbackNameError.textContent = '';
    }
  });

  // ----------------------------------------------------------------------------
  // 3. 좋아요 / 싫어요 반응 클릭 핸들러
  // ----------------------------------------------------------------------------
  async function handleReaction(title, action, likeBtn, dislikeBtn, likeCountSpan, dislikeCountSpan) {
    // 중복 클릭 방지 (버튼 일시 비활성화)
    likeBtn.disabled = true;
    dislikeBtn.disabled = true;

    try {
      const result = await sendReaction(title, action);
      likeCountSpan.textContent = String(result.likes || 0);
      dislikeCountSpan.textContent = String(result.dislikes || 0);

      // 선택된 버튼에 활성 클래스 부여
      if (action === 'like') {
        likeBtn.classList.add('active');
      } else {
        dislikeBtn.classList.add('active');
      }
    } catch {
      alert('반응을 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      likeBtn.disabled = false;
      dislikeBtn.disabled = false;
    }
  }

  // ----------------------------------------------------------------------------
  // 4. 드라마 취향 추천 제출 처리
  // ----------------------------------------------------------------------------
  recommendForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawPreference = preferenceInput.value;
    const validation = validatePreference(rawPreference);

    if (!validation.isValid) {
      preferenceError.textContent = validation.message;
      preferenceInput.focus();
      return;
    }

    preferenceError.textContent = '';
    setRecommendLoading(true);

    try {
      resultsSection.style.display = 'block';
      resultsList.replaceChildren();
      resultsStatus.style.display = 'none';
      resultsStatus.className = 'status-box';

      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // API 호출 (고도화된 추천)
      const data = await requestRecommendations(rawPreference);
      const recommendations = data?.recommendations || [];

      if (recommendations.length === 0) {
        showResultsStatus('입력하신 조건에 부합하는 드라마를 찾지 못했습니다. 다른 키워드나 분위기로 다시 시도해 보세요.', false);
      } else {
        // 결과 카드 DOM 생성
        recommendations.forEach(item => {
          const card = createRecommendationCard(item, handleReaction);
          resultsList.appendChild(card);
        });

        // 추천된 드라마들의 누적 좋아요/싫어요 수 비동기 조회
        const titles = recommendations.map(r => r.title);
        fetchReactions(titles).then(resData => {
          const reactionMap = resData?.reactions || {};
          recommendations.forEach(item => {
            const card = resultsList.querySelector(`article[data-title="${CSS.escape(item.title)}"]`);
            if (card && reactionMap[item.title]) {
              const likeCountSpan = card.querySelector('.like-count');
              const dislikeCountSpan = card.querySelector('.dislike-count');
              if (likeCountSpan) likeCountSpan.textContent = String(reactionMap[item.title].likes || 0);
              if (dislikeCountSpan) dislikeCountSpan.textContent = String(reactionMap[item.title].dislikes || 0);
            }
          });
        });
      }

    } catch (err) {
      showResultsStatus(err.message || '추천 서비스 처리 중 문제가 발생했습니다.', true);
    } finally {
      setRecommendLoading(false);
    }
  });

  function setRecommendLoading(isLoading) {
    recommendBtn.disabled = isLoading;
    preferenceInput.disabled = isLoading;
    if (isLoading) {
      recommendBtnText.style.display = 'none';
      recommendBtnLoading.style.display = 'inline';
    } else {
      recommendBtnText.style.display = 'inline';
      recommendBtnLoading.style.display = 'none';
    }
  }

  function showResultsStatus(message, isError) {
    resultsStatus.replaceChildren();
    const p = document.createElement('p');
    p.textContent = message;
    resultsStatus.appendChild(p);

    resultsStatus.className = isError ? 'status-box status-error' : 'status-box';
    resultsStatus.style.display = 'block';
  }

  // ----------------------------------------------------------------------------
  // 5. 익명 피드백 등록 및 목록 조회 처리
  // ----------------------------------------------------------------------------
  feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = feedbackName.value;
    const content = feedbackContent.value;

    const validation = validateFeedback(name, content);
    feedbackNameError.textContent = validation.nameError;
    feedbackContentError.textContent = validation.contentError;

    if (!validation.isValid) {
      return;
    }

    setFeedbackSubmitting(true);

    try {
      const savedItem = await submitFeedback(name, content);

      feedbackForm.reset();
      feedbackCharCounter.textContent = '0 / 1000';

      const newCard = createFeedbackCard(savedItem);
      if (feedbackList.firstChild) {
        feedbackList.insertBefore(newCard, feedbackList.firstChild);
      } else {
        feedbackList.appendChild(newCard);
      }

      feedbackStatus.style.display = 'none';
      alert('피드백이 성공적으로 등록되었습니다. 감사합니다!');

    } catch (err) {
      feedbackContentError.textContent = err.message || '피드백 등록에 실패했습니다.';
    } finally {
      setFeedbackSubmitting(false);
    }
  });

  function setFeedbackSubmitting(isSubmitting) {
    feedbackBtn.disabled = isSubmitting;
    feedbackName.disabled = isSubmitting;
    feedbackContent.disabled = isSubmitting;
    if (isSubmitting) {
      feedbackBtnText.style.display = 'none';
      feedbackBtnLoading.style.display = 'inline';
    } else {
      feedbackBtnText.style.display = 'inline';
      feedbackBtnLoading.style.display = 'none';
    }
  }

  async function loadFeedbacks(isInitial = false) {
    if (isInitial) {
      feedbackOffset = 0;
      feedbackList.replaceChildren();
      feedbackStatus.style.display = 'block';
      feedbackStatus.className = 'status-box';
      feedbackStatus.textContent = '피드백을 불러오는 중입니다...';
      loadMoreBtn.style.display = 'none';
    }

    try {
      const data = await fetchFeedbackList(FEEDBACK_LIMIT, feedbackOffset);
      const items = data?.items || [];
      const hasMore = !!data?.hasMore;

      if (isInitial && items.length === 0) {
        feedbackStatus.textContent = '아직 등록된 피드백이 없습니다. 첫 번째 의견을 남겨보세요!';
        feedbackStatus.style.display = 'block';
        return;
      }

      feedbackStatus.style.display = 'none';

      items.forEach(item => {
        const card = createFeedbackCard(item);
        feedbackList.appendChild(card);
      });

      feedbackOffset += items.length;

      if (hasMore) {
        loadMoreBtn.style.display = 'inline-block';
      } else {
        loadMoreBtn.style.display = 'none';
      }

    } catch (err) {
      if (isInitial) {
        feedbackStatus.className = 'status-box status-error';
        feedbackStatus.textContent = err.message || '피드백 목록을 불러오지 못했습니다.';
        feedbackStatus.style.display = 'block';
      } else {
        alert(err.message || '추가 피드백을 불러오는 중 오류가 발생했습니다.');
      }
    }
  }

  loadMoreBtn.addEventListener('click', () => {
    loadFeedbacks(false);
  });

  loadFeedbacks(true);
});
