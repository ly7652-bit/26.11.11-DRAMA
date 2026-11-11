// ==============================================================================
// 파일명: public/js/validation.js
// 설명: 클라이언트 측 사용자 입력 검증 모듈
// 담당 역할: 
//   1. 취향 입력값 길이 및 형식 검증 (5~500자)
//   2. 피드백 작성자 이름 (선택, 최대 40자) 및 내용 (필수, 2~1000자) 검증
// ==============================================================================

/**
 * 드라마 취향 입력값 유효성을 검사합니다.
 * @param {string} preference 
 * @returns {{ isValid: boolean, message: string }}
 */
export function validatePreference(preference) {
  if (typeof preference !== 'string') {
    return {
      isValid: false,
      message: '취향을 텍스트로 입력해 주세요.'
    };
  }

  const trimmed = preference.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      message: '원하는 드라마 취향이나 분위기를 입력해 주세요.'
    };
  }

  if (trimmed.length < 5) {
    return {
      isValid: false,
      message: '취향 설명은 최소 5자 이상 입력해 주세요.'
    };
  }

  if (trimmed.length > 500) {
    return {
      isValid: false,
      message: '취향 설명은 500자 이내로 입력해 주세요.'
    };
  }

  return {
    isValid: true,
    message: ''
  };
}

/**
 * 피드백 입력 폼의 유효성을 검사합니다.
 * @param {string} name 
 * @param {string} content 
 * @returns {{ isValid: boolean, nameError: string, contentError: string }}
 */
export function validateFeedback(name, content) {
  let isValid = true;
  let nameError = '';
  let contentError = '';

  // 이름 검증 (선택 항목, 최대 40자)
  if (typeof name === 'string' && name.trim().length > 40) {
    isValid = false;
    nameError = '이름은 최대 40자까지 입력 가능합니다.';
  }

  // 내용 검증 (필수 항목, 공백 제외 2~1000자)
  if (typeof content !== 'string') {
    isValid = false;
    contentError = '피드백 내용을 입력해 주세요.';
  } else {
    const trimmedContent = content.trim();
    if (trimmedContent.length < 2) {
      isValid = false;
      contentError = '피드백 내용은 최소 2자 이상 입력해 주세요.';
    } else if (trimmedContent.length > 1000) {
      isValid = false;
      contentError = '피드백 내용은 최대 1000자 이내로 작성해 주세요.';
    }
  }

  return {
    isValid,
    nameError,
    contentError
  };
}

