# 이 프로젝트를 이어서 작업할 때

1. `README.md`, `docs/PROGRESS.md`, `docs/ROADMAP.md`부터 읽고 마지막 완료 단계와 다음 단계를 확인합니다.
2. 사용자가 진행 상황을 물으면 단계 번호, 완료한 내용, 실제로 검증한 범위, 다음 작업을 구분해 답합니다.
3. 각 단계 작업 후 `PROGRESS.md`와 `VALIDATION.md`를 갱신합니다. 코드 작성과 실제 외부 연동·배포를 같은 완료 상태로 기록하지 않습니다.
4. 현재는 가상 데이터 기반 로컬 시제품입니다. 실제 DB·로그인·밀리패스·공식 평가표·운동 전문가 검토는 아직 연결되지 않았습니다.
5. 수행 인증 / 측정 인증 / 공식 결과를 분리하고, 인증된 측정만 랭킹에 반영합니다. 제출된 과거 루틴 버전과 인증 이력을 보존합니다.
6. 실제 데이터 교체에 필요한 항목은 `docs/DATA_PLAN.md`, 배포 준비 항목은 `docs/DEPLOYMENT.md`를 따릅니다.
7. React Bits·Cult UI 소스와 라이선스, 사용자가 준 원본 파일을 보존합니다. 사용한 구성요소만 `THIRD_PARTY_NOTICES.md`에 기록합니다.
8. 운영용 경로는 Next.js `dev` / `build`입니다. `build:sites`는 원본 스타터 보존용입니다. DB는 PostgreSQL 저장소 경계에서 연결합니다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
