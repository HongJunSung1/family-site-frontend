# 홍준성-하정윤 가족 사이트 제작하기
가족 구성원이 **PC / 모바일 웹**에서 함께 사용할 수 있는 웹앱입니다.  
추후 **가족 가계부**를 중심으로 다양한 기능을 확장할 예정입니다.(하고 싶습니다.)

---

## 운영 요약

- 프론트 수정 → GitHub push → Pages 자동 배포
- 백엔드 수정 → npx wrangler deploy
- DB 구조 변경
  - schema.sql 수정
  - 로컬 execute → 운영 execute

---

## 🌐 사이트 주소

- **Frontend (Cloudflare Pages)**  
  https://family-site-frontend.pages.dev  

> 2026-01-25. 초기 배포 단계로, 화면 파일이 없어 404 페이지가 보일 수 있습니다.  
> 2026-01-28. 리액트 + Vite 연동 완료
> 2026-02-01. DB 연동 완료(테스트 데이터 넣기 완료)

---

## 🧱 기술 스택

### Frontend
- **React + TypeScript**
- **Vite** (개발 서버 / 빌드 도구)
- **Cloudflare Pages**  
  - 정적 웹 호스팅
  - GitHub push 시 자동 빌드 & 배포
  - 글로벌 CDN 제공한다해서 그게 뭔지도 잘 모르면서 멋있어 보이길래 이걸로 함

### Backend (API)
- **Cloudflare Workers**
- REST API (JSON 기반)
- 서버리스 구조
**백엔드 배포**
```bash
실서버 : npx wrangler deploy
로컬: wrangler dev --remote    // API 연동된 내역 불러오려면 --remote를 붙여야 함
```

### Database
- **Cloudflare D1 SQL Database**
- SQLite 기반 관계형 DB
- SQL 쿼리 기반 CRUD / JOIN / 집계 가능
- 실서버 테이블 생성/수정은 반드시 wrangler 커맨드로 실행
- schema.sql 파일에 최종 수정내역을 항상 추가/저장한다.
- DB 신규/수정사항이 있을 때 배포
  -> schema.sql에 SQL문 작성한다.
  1) **로컬**  
  ```bash
  npx wrangler d1 execute family-site-db --local --file=schema.sql
  ``` 
  2) **운영(로컬에서 문제 없으면)**  
  ```bash
  npx wrangler d1 execute family-site-db --remote --file=schema.sql
  ```
- DB 내 테이블을 삭제할 때
  -> schema.sql에 작성하지 않고 직접 터미널에서 코드 실행한다.
  -> 로컬은 터미널에서 해도 되고 DBEAVER에서 SQL문 작성해도 되지만 실서버는 아래와 같이 진행한다.
  ```bash
  npx wrangler d1 execute family-site-db --remote --command "DROP TABLE 테이블명;"
  ```
  
---

## 🚀 Frontend Deployment
프로젝트는 **Cloudflare Pages**를 사용하여 배포 진행

- Production Branch: `master`
- Deployment 방식: GitHub 연동 자동 배포
- URL: https://family-site-frontend.pages.dev

깃허브에 `master` 브랜치로 push 시 Cloudflare Pages에서 자동으로 빌드 및 배포 진행

---

## 📦 Build Configuration (Cloudflare Pages)

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`
<img width="1908" height="828" alt="image" src="https://github.com/user-attachments/assets/b5cb78e3-930a-43d6-8a45-c36247af0ef6" />
--


## 🔁 전체 구조

```text
[ Browser (PC / Mobile) ]
          ↓
[ Cloudflare Pages (Frontend) ]
          ↓  HTTP (JSON)
[ Cloudflare Workers (Backend API) ]
          ↓  SQL
[ Cloudflare D1 (Database) ]
```

## 🆓 무료 플랜 기준 사용 정책

본 프로젝트는 **유료 결제 없이 Cloudflare 무료 플랜만 사용**하는 것을 목표로 함

### Cloudflare Pages
- 정적 웹사이트 호스팅
- GitHub 저장소와 연동하여 자동 빌드 및 배포
- 전 세계 CDN 제공
- 개인/가족 단위 서비스 운영에 충분한 성능

### Cloudflare Workers
- 서버리스 백엔드(API) 실행 환경
- HTTP 기반 REST API(JSON)
- 별도 서버 운영 없이 요청 시에만 실행
- 소규모 트래픽 기준 무료 플랜으로 충분

### Cloudflare D1 SQL Database
- SQLite 기반 관계형 데이터베이스
- SQL 기반 CRUD / JOIN / 집계 가능
- **DB당 약 500MB 내외의 용량 제한**
- 계정 전체 기준 스토리지 한도 존재

> 본 프로젝트는 **텍스트/숫자 위주 데이터**를 저장하는 구조로 설계하여  
> 무료 플랜 용량 내에서 장기간 운영 가능하도록 할 예정  
>  
> 이미지, 동영상 등 대용량 파일은  
> DB에 직접 저장하지 않고 별도 스토리지 사용을 검토



## 프론트엔드
### SPA Routing 설정 (중요)

React SPA 특성상 새로고침 시 404 오류를 방지하기 위해  
Cloudflare Pages용 `_redirects` 파일을 설정.
 - 모든 경로 요청을 `index.html`로 전달하여 React Router가 정상적으로 동작하도록 만들기 위함

### 화면 구조
### 라우팅
### 상태 관리
### API 연동

## 백엔드
### API 목록
### 인증 방식
### Workers 구조

## 데이터베이스
### 테이블 설계
### ERD
### 주요 쿼리

