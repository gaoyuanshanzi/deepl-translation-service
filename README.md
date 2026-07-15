# TransLingo — DeepL 기반 다국어 문서 번역 서비스

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-repo/deepl-translation-service)

## 개요

DeepL API를 활용한 웹 기반 다국어 문서 번역 서비스입니다.

### 지원 언어
- 🇺🇸 English (EN)
- 🇰🇷 한국어 (KO)
- 🇨🇳 中文 (ZH)
- 🇯🇵 日本語 (JA)

### 주요 기능
- TXT / HTML 파일 업로드 (드래그 앤 드롭 지원)
- 업로드된 문서의 언어 자동 감지
- 동일 언어 선택 시 오류 안내
- 청크 단위 번역 + 실시간 진행률(%) 표시
- 번역 결과 HTML / TXT 형식으로 다운로드
- 브라우저 새로고침 시 세션 유지

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 로그인 정보

| 항목 | 값 |
|------|-----|
| 아이디 | admin |
| 비밀번호 | 123jesus |
| DeepL API Key | 직접 입력 |

## DeepL API Key 발급

1. [DeepL 계정](https://www.deepl.com/ko/account/summary) 가입
2. API Keys 섹션에서 키 발급
3. Free 플랜: `:fx`로 끝나는 키
4. Pro 플랜: 일반 키

## 기술 스택

- **Frontend**: Next.js 14 (React 18)
- **Backend**: Next.js API Routes (Serverless)
- **번역**: DeepL API v2
- **배포**: Vercel
- **스타일**: Vanilla CSS (Glassmorphism Dark Theme)
