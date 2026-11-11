// ==============================================================================
// 파일명: public/js/app.js
// 설명: 드라마 추천 서비스의 메인 프론트엔드 제어 컨트롤러
// 담당 역할:
//   1. 이벤트 리스너 바인딩 (추천 폼 제출, 피드백 폼 제출, 더보기 등)
//   2. 입력 글자 수 실시간 카운팅
//   3. 로딩, 빈 결과, 에러 상태 관리 및 화면 렌더링 조율
// ==============================================================================

import { validatePreference, validateFeedback } from './validation.js';
import { requestRecommendations, fetchFeedbackList, submitFeedback } from './api.js';
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

  // 피드백 페이징 상태 변수
  let feedbackOffset = 0;
  const FEEDBACK_LIMIT = 20;

  // ----------------------------------------------------------------------------
  // 2. 글자 수 카운터 및 키보드 입력 핸들러
  // ----------------------------------------------------------------------------

  // 취향 입력창 글자 수 카운팅
  preferenceInput.addEventListener('input', () => {
    const currentLength = preferenceInput.value.length;
    charCounter.textContent = `${currentLength} / 500`;
    if (preferenceError.textContent) {
      preferenceError.textContent = '';
    }
  });

  // 줄바꿈이 아닌 Ctrl+Enter / Cmd+Enter 키로 빠른 제출 지원
  preferenceInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      recommendForm.requestSubmit();
    }
  });

  // 피드백 내용 글자 수 카운팅
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
  // 3. 드라마 취향 추천 제출 처리
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
      // 추천 섹션 열기 및 초기화
      resultsSection.style.display = 'block';
      resultsList.replaceChildren(); // 기존 카드 초기화
      resultsStatus.style.display = 'none';
      resultsStatus.className = 'status-box';

      // 스크롤을 결과 섹션으로 부드럽게 이동
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // API 호출
      const data = await requestRecommendations(rawPreference);
      const recommendations = data?.recommendations || [];

      if (recommendations.length === 0) {
        showResultsStatus('입력하신 조건에 맞는 드라마를 찾지 못했습니다. 다른 키워드나 분위기로 다시 시도해 보세요.', false);
      } else {
        // 결과 카드 추가
        recommendations.forEach(item => {
          const card = createRecommendationCard(item);
          resultsList.appendChild(card);
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
  // 4. 익명 피드백 등록 및 목록 조회 처리
  // ----------------------------------------------------------------------------

  // 피드백 폼 제출 핸들러
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

      // 입력 폼 초기화
      feedbackForm.reset();
      feedbackCharCounter.textContent = '0 / 1000';

      // 목록 최상단에 즉시 새 카드 추가
      const newCard = createFeedbackCard(savedItem);
      if (feedbackList.firstChild) {
        feedbackList.insertBefore(newCard, feedbackList.firstChild);
      } else {
        feedbackList.appendChild(newCard);
      }

      // '피드백 없음' 안내 박스가 켜져 있었다면 숨김
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

  // 피드백 목록 로드 함수
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

      // 더 보기 버튼 표시 여부
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

  // 더 보기 버튼 클릭 핸들러
  loadMoreBtn.addEventListener('click', () => {
    loadFeedbacks(false);
  });

  // 초기 피드백 목록 로드 시작
  loadFeedbacks(true);
});

