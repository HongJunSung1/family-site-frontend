# 홍준성-하정윤 가족 사이트 제작하기
가족 구성원이 **PC / 모바일 웹**에서 함께 사용할 수 있는 웹앱입니다.  
추후 **가족 가계부**를 중심으로 다양한 기능을 확장할 예정입니다.(하고 싶습니다.)

---

## 🌐 사이트 주소

- **Frontend (Cloudflare Pages)**  
  https://family-site-frontend.pages.dev  

> 2026-01-25. 초기 배포 단계로, 화면 파일이 없어 404 페이지가 보일 수 있습니다.  

---

## 🧱 기술 스택

### Frontend
- **React + TypeScript**
- **Vite** (개발 서버 / 빌드 도구)
- **Cloudflare Pages**  
  - 정적 웹 호스팅
  - GitHub push 시 자동 빌드 & 배포
  - 글로벌 CDN 제공한다해서 멋있어보여서 이걸로 함

### Backend (API)
- **Cloudflare Workers**
- REST API (JSON 기반)
- 서버리스 구조

### Database
- **Cloudflare D1 SQL Database**
- SQLite 기반 관계형 DB
- SQL 쿼리 기반 CRUD / JOIN / 집계 가능

---

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

본 프로젝트는 **유료 결제 없이 Cloudflare 무료 플랜만 사용**하는 것을 목표로 합니다.

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

> 본 프로젝트는 가계부 등 **텍스트/숫자 위주 데이터**를 저장하는 구조로 설계하여  
> 무료 플랜 용량 내에서 장기간 운영 가능하도록 합니다.  
>  
> 이미지, 동영상 등 대용량 파일은  
> DB에 직접 저장하지 않고 별도 스토리지 사용을 검토합니다.


