# 배포 준비 · 아직 배포하지 않음

## 현재 실행 방식

`npm run dev`는 로컬 개발 시제품을 엽니다. `npm run build`는 Next.js 운영 산출물을 생성합니다. `npm start` / Docker 운영 실행은 실제 DB와 인증 설정을 요구합니다. 데모 역할 전환과 로컬 파일 저장은 production에서 차단됩니다.

## 선택 가능한 배포 조합

| 구성 | 앱 / API | 데이터 저장 | 준비물 |
|---|---|---|---|
| Vercel + Supabase | Next.js 기본 배포 | Supabase PostgreSQL 서버 연결 | 서버 전용 DB URL, 실제 로그인·토큰 연결, APP_ORIGIN |
| Vercel + 다른 PostgreSQL | Next.js 기본 배포 | 호환 PostgreSQL | 연결 풀·SSL 설정 확인 |
| AWS | Docker / Node standalone | RDS PostgreSQL 등 | 네트워크·비밀키·인증 제공자·로그·백업 설정 |

특정 업체 API를 도메인 계산에 넣지 않았습니다. AWS에서도 같은 서버 업무 로직을 사용합니다. DB는 `lib/server/postgres.ts`가 담당합니다. Vercel에서 `.data/demo.json`을 사용하면 안 됩니다. Supabase는 여기서는 PostgreSQL 공급자이며, 앱을 정적 페이지로만 배포하는 구조가 아닙니다.

## D2 실제 DB 연결 순서

1. 별도 개발용 PostgreSQL 프로젝트와 서버 전용 계정을 만듭니다.
2. `.env.example`을 `.env.local`로 복사해 `DATABASE_URL`을 설정합니다. 비밀키를 소스·브라우저 변수에 넣지 않습니다.
3. `npm run db:migrate`를 실행합니다. `db/001_initial.sql`은 fitness 전용 스키마를 만듭니다. 기존 자료를 삭제하거나 데모 데이터를 자동으로 넣지 않습니다.
4. 개발 전용 빈 DB에서만 `ALLOW_DEMO_DB_SEED=yes`를 명시하고 `npm run db:seed:demo`로 가상 자료를 넣을 수 있습니다. 기존 사용자가 있으면 중단합니다.
5. 서버 계정의 스키마/테이블/시퀀스 권한과 RLS 동작을 확인합니다. 일반 브라우저/anon 역할에는 정책을 제공하지 않았습니다. DB 소유자 또는 별도 검토된 서버 역할이 필요합니다.
6. 트랜잭션 롤백, 동시 승인, 재시작, 백업 복구를 실제 DB에서 검증합니다. 현재 PostgreSQL 어댑터는 전체 상태를 잠그는 소규모 시범 구조입니다.
7. 실제 자료 환경에는 가상 자료를 섞지 않고 로그인 sub와 등록 사용자 ID를 연결합니다.

## R2 실제 배포 전 남은 항목

- [ ] 실제 로그인 UI / 토큰 세션 수명 / 로그아웃 / 초대 및 사용자 등록 연결
- [ ] 조직 권한 프로비저닝·변경·회수 절차, JWT sub 매핑
- [ ] 검토된 운동 기준·공식 평가표·검토 버전 교체
- [ ] 실제 PostgreSQL 연결·마이그레이션·권한 검증
- [ ] 요청 속도 제한, API 본문 스트리밍 크기 제한, 페이지네이션 및 조직별 쿼리 최적화
- [ ] 실제 데이터 보관·파기 정책, 운영 로그 마스킹·보존, 백업·복구
- [ ] 배포처 선택, HTTPS 도메인, APP_ORIGIN, 비밀키 저장소
- [ ] 운영 테스트 계정으로 전체 흐름 재검증
- [ ] 운영 책임자·문의·장애 대응 인계

## 설정

운영: `NODE_ENV=production`, `APP_MODE=production`, `APP_ORIGIN=https://실제도메인`, `DATABASE_URL`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`.

JWT 검증은 RS256/ES256을 허용합니다. 사용하는 인증 제공자의 서명 방식과 연결 규격을 실제로 확인해야 합니다. 직접 로그인 제공자를 만들거나 밀리패스 인증을 흉내내지 않습니다.

## 포함된 배포 파일과 검증 범위

- `next.config.ts`: Node standalone 출력, 기본 보안 응답 헤더
- `Dockerfile`: AWS 등 Node 컨테이너용 다단계 빌드
- `vercel.json`: Next.js 빌드·설치 설정
- `.dockerignore`, `.gitignore`: 의존성·로컬 업무 데이터·비밀키 제외

Next.js 빌드는 실행·확인했습니다. Docker 이미지 빌드, Vercel/AWS 배포, PostgreSQL 실연결은 실행하지 않았습니다. `build:sites`는 원본 스타터 경로 보존용이며 이번 앱의 검증된 배포 명령은 `build`입니다.

공식 참고: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Vercel Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs), [Supabase PostgreSQL 연결](https://supabase.com/docs/guides/database/connecting-to-postgres).
