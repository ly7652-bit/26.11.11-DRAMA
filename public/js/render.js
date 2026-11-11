// ==============================================================================
// 파일명: public/js/render.js
// 설명: 화면 DOM 요소를 안전하게 생성하고 렌더링하는 모듈 (고도화 버전)
// 개선 사항:
//   1. 1위, 2위, 3위 순위별 클래스(rank-1, rank-2, rank-3) 부여
//   2. 순위 배지 바로 옆에 [👍 좋아요] 및 [👎 싫어요] 누적 반응 버튼 배치
//   3. 실제 드라마 줄거리(3~5줄) 및 주요 등장인물 카드 영역 추가
//   4. XSS 방지를 위한 textContent 및 DOM 안전 생성 원칙 철저 준수
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
 * @param {Function} onReaction 
 * @returns {HTMLElement}
 */
export function createRecommendationCard(item, onReaction) {
  const card = document.createElement('article');
  card.className = `result-card rank-${item.rank}`;
  card.dataset.title = item.title;

  // 1. 헤더 (순위 배지 + 좋아요/싫어요 버튼 + 작품 제목)
  const header = document.createElement('div');
  header.className = 'card-header';

  // 왼쪽: 순위 배지 & 반응 버튼 그룹
  const headerLeft = document.createElement('div');
  headerLeft.className = 'header-left';

  const badge = document.createElement('span');
  badge.className = `rank-badge rank-badge-${item.rank}`;
  badge.textContent = `${item.rank}위`;
  headerLeft.appendChild(badge);

  // 좋아요 / 싫어요 반응 버튼 그룹 (순위 옆에 배치)
  const reactionsGroup = document.createElement('div');
  reactionsGroup.className = 'reactions-group';

  // 좋아요 버튼
  const likeBtn = document.createElement('button');
  likeBtn.type = 'button';
  likeBtn.className = 'btn-reaction btn-like';
  likeBtn.setAttribute('aria-label', `${item.title} 좋아요`);

  const likeIcon = document.createElement('span');
  likeIcon.textContent = '👍';
  const likeCountSpan = document.createElement('span');
  likeCountSpan.className = 'reaction-count like-count';
  likeCountSpan.textContent = '0';

  likeBtn.appendChild(likeIcon);
  likeBtn.appendChild(likeCountSpan);

  likeBtn.addEventListener('click', () => {
    if (typeof onReaction === 'function') {
      onReaction(item.title, 'like', likeBtn, dislikeBtn, likeCountSpan, dislikeCountSpan);
    }
  });

  // 싫어요 버튼
  const dislikeBtn = document.createElement('button');
  dislikeBtn.type = 'button';
  dislikeBtn.className = 'btn-reaction btn-dislike';
  dislikeBtn.setAttribute('aria-label', `${item.title} 싫어요`);

  const dislikeIcon = document.createElement('span');
  dislikeIcon.textContent = '👎';
  const dislikeCountSpan = document.createElement('span');
  dislikeCountSpan.className = 'reaction-count dislike-count';
  dislikeCountSpan.textContent = '0';

  dislikeBtn.appendChild(dislikeIcon);
  dislikeBtn.appendChild(dislikeCountSpan);

  dislikeBtn.addEventListener('click', () => {
    if (typeof onReaction === 'function') {
      onReaction(item.title, 'dislike', likeBtn, dislikeBtn, likeCountSpan, dislikeCountSpan);
    }
  });

  reactionsGroup.appendChild(likeBtn);
  reactionsGroup.appendChild(dislikeBtn);
  headerLeft.appendChild(reactionsGroup);

  // 오른쪽: 작품 제목
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = item.title;

  header.appendChild(headerLeft);
  header.appendChild(title);
  card.appendChild(header);

  // 2. 메타 정보 (연도 및 장르)
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
  scoreValue.className = `score-value score-value-${item.rank}`;
  const percentage = Math.max(0, Math.min(100, Math.round(item.matchPercentage || 0)));
  scoreValue.textContent = `${percentage}%`;

  scoreHeader.appendChild(scoreLabel);
  scoreHeader.appendChild(scoreValue);
  scoreWrapper.appendChild(scoreHeader);

  const progressBg = document.createElement('div');
  progressBg.className = 'progress-bar-bg';
  progressBg.setAttribute('role', 'progressbar');
  progressBg.setAttribute('aria-valuenow', String(percentage));
  progressBg.setAttribute('aria-valuemin', '0');
  progressBg.setAttribute('aria-valuemax', '100');
  progressBg.setAttribute('aria-label', `${item.title} 취향 매칭 점수 ${percentage}%`);

  const progressFill = document.createElement('div');
  progressFill.className = `progress-bar-fill progress-fill-${item.rank}`;
  progressFill.style.width = `${percentage}%`;
  progressBg.appendChild(progressFill);

  scoreWrapper.appendChild(progressBg);
  card.appendChild(scoreWrapper);

  // 4. 추천 이유 (2줄 요약)
  const reasonBox = document.createElement('div');
  reasonBox.className = 'detail-section reason-section';

  const reasonTitle = document.createElement('h4');
  reasonTitle.className = 'detail-section-title';
  reasonTitle.textContent = '💡 추천 이유 요약';

  const reason = document.createElement('p');
  reason.className = 'card-reason';
  reason.textContent = item.reason;

  reasonBox.appendChild(reasonTitle);
  reasonBox.appendChild(reason);
  card.appendChild(reasonBox);

  // 5. 실제 줄거리 요약 (3~5줄 분량)
  if (item.synopsis) {
    const synopsisBox = document.createElement('div');
    synopsisBox.className = 'detail-section synopsis-section';

    const synopsisTitle = document.createElement('h4');
    synopsisTitle.className = 'detail-section-title';
    synopsisTitle.textContent = '📖 핵심 줄거리';

    const synopsisText = document.createElement('p');
    synopsisText.className = 'card-synopsis';
    synopsisText.textContent = item.synopsis;

    synopsisBox.appendChild(synopsisTitle);
    synopsisBox.appendChild(synopsisText);
    card.appendChild(synopsisBox);
  }

  // 6. 주요 등장인물
  if (Array.isArray(item.characters) && item.characters.length > 0) {
    const charBox = document.createElement('div');
    charBox.className = 'detail-section characters-section';

    const charTitle = document.createElement('h4');
    charTitle.className = 'detail-section-title';
    charTitle.textContent = '👥 주요 등장인물';

    const charList = document.createElement('ul');
    charList.className = 'character-list';

    item.characters.forEach(charInfo => {
      const li = document.createElement('li');
      li.className = 'character-item';
      li.textContent = charInfo;
      charList.appendChild(li);
    });

    charBox.appendChild(charTitle);
    charBox.appendChild(charList);
    card.appendChild(charBox);
  }

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
