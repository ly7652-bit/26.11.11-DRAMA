// ==============================================================================
// 파일명: server.js
// 설명: 외부 로그인 없이 내 컴퓨터에서 바로 실행할 수 있는 로컬 개발 서버
// 역할:
//   1. public/ 폴더의 웹 페이지(HTML, CSS, JS) 서빙
//   2. api/recommend.js 및 api/feedback/index.js 서버리스 함수 라우팅
//   3. http://localhost:3000 으로 로컬 서비스 제공
// ==============================================================================

import express from 'express';
import 'dotenv/config';
import recommendHandler from './api/recommend.js';
import feedbackHandler from './api/feedback/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 1. JSON 요청 본문 파싱 미들웨어 설정
app.use(express.json());

// 2. public 디렉터리의 정적 파일(HTML, CSS, JS) 제공
app.use(express.static('public'));

// 3. 드라마 추천 API 라우트 연결
app.all('/api/recommend', async (req, res) => {
  try {
    await recommendHandler(req, res);
  } catch (error) {
    console.error('[API Error /api/recommend]:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: '추천 서버 내부 오류가 발생했습니다.' } });
    }
  }
});

// 4. 익명 피드백 API 라우트 연결
app.all('/api/feedback', async (req, res) => {
  try {
    await feedbackHandler(req, res);
  } catch (error) {
    console.error('[API Error /api/feedback]:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: '피드백 서버 내부 오류가 발생했습니다.' } });
    }
  }
});

// 5. 서버 실행 시작
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 드라마 추천 로컬 서버가 성공적으로 실행되었습니다!`);
  console.log(`👉 인터넷 브라우저를 열고 아래 주소로 접속하세요:`);
  console.log(`   http://localhost:${PORT}`);
  console.log('====================================================');
  console.log(`[안내] 서버를 종료하시려면 터미널에서 Ctrl + C 를 누르세요.`);
});

