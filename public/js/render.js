// ==============================================================================
// 파일명: public/js/render.js
// 설명: 화면 DOM 요소를 안전하게 생성하고 렌더링하는 모듈
// 보안 원칙:
//   - XSS 방지를 위해 innerHTML 사용을 엄격히 배제하고 textContent 및 DOM 메서드만 사용
//   - 점수 막대 및 상태 메시지에 웹 접근성(ARIA) 속성 준수
// ==============================================================================

/**
 * 날짜 문자열을 읽기 쉬운 한국어 형식(YYYY. MM. DD. HH:mm)으로 변환합니다.
 * @param {string} isoString 
 * @returns {string}
 */
export function formatDate(isoString) {
  if (!isoString) return '날짜 정보 없음';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '날짜 정보 없음';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}. ${month}. ${day}. ${hours}:${minutes}`;
  } catch {
    return '날짜 정보 없음';
  }
}

/**
 * 개별 추천 드라마 결과 카드를 안전한 DOM 요소로 생성합니다.
 * @param {Object} item 
 * @returns {HTMLElement}
 */
export function createRecommendationCard(item) {
  const card = document.createElement('article');
  card.className = 'result-card';

  // 1. 헤더 (순위 배지 + 제목)
  const header = document.createElement('div');
  header.className = 'card-header';

  const badgeWrapper = document.createElement('div');
  const badge = document.createElement('span');
  badge.className = 'rank-badge';
  badge.textContent = `${item.rank}위`;
  badgeWrapper.appendChild(badge);

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = item.title;

  header.appendChild(badgeWrapper);
  header.appendChild(title);
  card.appendChild(header);

  // 2. 메타 정보 (연도 및 장르 - 데이터가 있을 때만 표시)
  const metaParts = [];
  if (item.year) {
    metaParts.push(`${item.year}년`);
  }
  if (Array.isArray(item.genres) && item.genres.length > 0) {
    metaParts.push(item.genres.join(' · '));
  }

  if (metaParts.length > 0) {
    const meta = document.createElement('p');
    meta.className = 'card-meta';
    meta.textContent = metaParts.join(' | ');
    card.appendChild(meta);
  }

  // 3. 매칭 백분율 및 시각적 진행 막대
  const scoreWrapper = document.createElement('div');
  scoreWrapper.className = 'score-wrapper';

  const scoreHeader = document.createElement('div');
  scoreHeader.className = 'score-header';

  const scoreLabel = document.createElement('span');
  scoreLabel.textContent = '취향 매칭 점수';

  const scoreValue = document.createElement('span');
  scoreValue.className = 'score-value';
  const percentage = Math.max(0, Math.min(100, Math.round(item.matchPercentage || 0)));
  scoreValue.textContent = `${percentage}%`;

  scoreHeader.appendChild(scoreLabel);
  scoreHeader.appendChild(scoreValue);
  scoreWrapper.appendChild(scoreHeader);

  // 접근성을 고려한 progressbar 요소
  const progressBg = document.createElement('div');
  progressBg.className = 'progress-bar-bg';
  progressBg.setAttribute('role', 'progressbar');
  progressBg.setAttribute('aria-valuenow', String(percentage));
  progressBg.setAttribute('aria-valuemin', '0');
  progressBg.setAttribute('aria-valuemax', '100');
  progressBg.setAttribute('aria-label', `${item.title} 취향 매칭 점수 ${percentage}%`);

  const progressFill = document.createElement('div');
  progressFill.className = 'progress-bar-fill';
  progressFill.style.width = `${percentage}%`;
  progressBg.appendChild(progressFill);

  scoreWrapper.appendChild(progressBg);
  card.appendChild(scoreWrapper);

  // 4. 추천 분석 이유
  const reason = document.createElement('p');
  reason.className = 'card-reason';
  reason.textContent = item.reason;
  card.appendChild(reason);

  return card;
}

/**
 * 피드백 목록에 표시할 개별 피드백 카드를 안전한 DOM 요소로 생성합니다.
 * @param {Object} item 
 * @returns {HTMLElement}
 */
export function createFeedbackCard(item) {
  const card = document.createElement('div');
  card.className = 'feedback-card';

  const header = document.createElement('div');
  header.className = 'feedback-header';

  const author = document.createElement('span');
  author.className = 'feedback-author';
  author.textContent = item.displayName || '익명';

  const date = document.createElement('span');
  date.className = 'feedback-date';
  date.textContent = formatDate(item.createdAt);

  header.appendChild(author);
  header.appendChild(date);
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'feedback-body';
  body.textContent = item.content;
  card.appendChild(body);

  return card;
}

