# API 계약 · v1

모든 API는 같은 출처의 `/api/v1`에서 동작합니다. 응답은 `Cache-Control: no-store`입니다. 성공은 `{data: ...}`, 오류는 `{error:{code,message,fields?}}`입니다. `health`, `session`은 작은 직접 응답입니다.

| 메서드 / 경로 | 역할 | 요청 / 결과 |
|---|---|---|
| GET `/health` | 공통 | 서버 동작 상태, demo/production 모드. DB 연결 검사는 아님 |
| POST `/session` | 로컬 개발 한정 | `{role:'soldier'|'admin'}`; 서명된 HttpOnly 체험 쿠키 |
| GET `/snapshot` | 등록 사용자 | 본인 자료, 또는 소속 부대의 관리자 자료 |
| POST `/goals` | 장병 | 목표 이력 추가, 다음 미실행 회차 갱신 |
| POST `/submissions` | 장병 | 수행/측정 요청 또는 자율 기록 생성 |
| POST `/submissions/:id/resubmit` | 본인 | 보완 요청 건의 값·시간·확인 근거 정정 후 pending |
| POST `/reviews` | 소속 부대 관리자 | 확인한 ID 목록을 승인·보완·반려·취소. 전체 성공 또는 전체 실패 |
| POST `/recovery` | 장병 | `{fatigue:1..5,pain:boolean}`; 즉시 다음 계획 반영 |
| POST `/preferences` | 장병 | `{shareScope:'private'|'unit'|'corps'|'region'|'national'}` |
| GET `/rankings?sport=run&scope=unit` | 등록 사용자 | 같은 평가군·방식·기간의 공개 동의자 개인 최고기록 |

## 공통

쓰기 요청은 `Content-Type: application/json`, 같은 출처의 `Origin`을 요구합니다. 운영 환경은 `APP_ORIGIN`을 정확히 설정합니다. 데모 쿠키는 로컬 개발에서만 동작합니다. 운영에서는 서명·issuer·audience를 검증한 `Authorization: Bearer <JWT>`를 받고, JWT의 `sub`로 서버에 등록된 사용자를 조회합니다. 클라이언트가 보낸 role/unit은 받지 않습니다.

운영용 로그인 화면·토큰 발급·사용자 등록은 후속 연동입니다. 토큰은 localStorage에 저장하지 않는 BFF/HttpOnly 운영 로그인 연결을 권장하며, 현재 UI는 로컬 체험을 위한 것입니다.

## 목표 입력

```json
{
  "grade": "개인 기록 향상",
  "targetDate": null,
  "run": 810,
  "pushup": 72,
  "situp": 86,
  "days": [1, 2, 4, 5, 6],
  "minutes": 35,
  "location": "both",
  "equipment": false,
  "excludedDates": []
}
```

요일은 0=일요일, 6=토요일입니다. 목표일은 오늘 이후 또는 null. 3km 단위는 초, 나머지는 횟수입니다. `grade`는 목표 명칭이며 등급 산식이 아닙니다. 기준표 확정 전에는 숫자를 등급으로 환산하지 않습니다.

## 수행 / 측정 입력

```json
{
  "kind": "performance",
  "routineId": "서버가 발급한 본인 회차 ID",
  "date": "2026-09-28",
  "sport": "situp",
  "value": 0,
  "completion": "complete",
  "minutes": 25,
  "rpe": 5,
  "fatigue": 2,
  "pain": false,
  "evidence": "현장 확인 근거와 실제 수행량",
  "idempotencyKey": "각 새 요청의 UUID"
}
```

- kind: `performance`, `measurement`, `self`. 공식 결과는 별도 테이블·수입 절차이며 일반 기록 API로 생성할 수 없습니다.
- 수행은 본인의 훈련 회차와 날짜·종목이 일치해야 합니다. 미래·휴식 회차는 제출할 수 없습니다.
- completion: `complete`, `partial`, `missed`. 미수행 시간은 0분.
- 측정은 routineId를 생략하고 실제 value를 보냅니다. 달리기는 초(300~3600), 횟수는 정수(1~200). 예시 측정 방식은 서버가 부여합니다.
- 동일 사용자·동일 idempotencyKey·동일 입력은 원래 결과를 반환합니다. 내용이 다르면 409. 같은 회차의 다른 요청도 409.
- 통증 보고는 인증 전에도 반영되며, 과거 기록을 입력하거나 다른 기록에서 통증 없음을 체크하는 것으로 현재 통증 신호를 지우지 않습니다. 컨디션 화면에서 명시적으로 갱신합니다.

## 인증 상태 전이

`pending → approved / changes / rejected`, `changes → pending`(보완 재제출), `approved → revoked`.

```json
{
  "ids": ["대상 기록 ID"],
  "action": "approved",
  "reason": "현장 타이머와 수행량 확인",
  "confirmed": true
}
```

한 번에 최대 30건. 전체 대상의 권한·상태를 먼저 검사합니다. `confirmed`는 직접 확인 표시이며 권한 검사를 대체하지 않습니다. 승인 취소는 XP·랭킹·미실행 계획을 재검토하고 인증 이력을 보존합니다. 반려/취소한 측정은 새 측정 건으로 재요청할 수 있습니다. 취소된 수행 회차의 재인증 정책은 시범 운영자 협의 후 추가할 후속 항목입니다.

## 랭킹

같은 평가군·종목·측정 방식, 최근 30일, `measurement + approved`만 사용합니다. 공개 범위는 서버에서 필터합니다. 지역과 군단 공개는 독립적이며 서로를 자동 허용하지 않습니다. 최소 3명 미만이면 개수만 제공하고 순위는 숨깁니다. 동점은 1,1,3 방식. 백분위 표시는 `round(순위/인원×100)`의 상위 비율입니다. 실명·세부 편성·회복 상태는 반환하지 않습니다.

## 오류 코드 예

401 세션/토큰 오류, 403 역할/소속/Origin, 404 없는 회차, 409 중복/이미 처리된 상태, 413 요청 크기, 415 형식, 422 입력값, 503 운영 인증 미설정. 알 수 없는 서버 오류는 500이며 내부 정보는 브라우저에 노출하지 않습니다.
