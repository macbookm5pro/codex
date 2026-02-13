# 경조사비 입력 앱 MVP 개발 계획 (Expo + React Native)

## 0) 프로젝트 개요
- **목표**: 사용자가 `"{name} {amount}"` 형태로 입력하면 경조사비 기록(Record)을 저장하고, Home/Person 화면에서 빠르게 조회할 수 있는 **로컬 우선(Local-first) 모바일 앱**을 구축한다.
- **예시 입력**: `홍길동 5` → `홍길동`에게 `50,000원` 기록 생성 (단위: 만원).
- **MVP 범위**:
  1. Home: 월별 그룹핑된 최근 기록 + 하단 sticky 입력바 + 입력 즉시 반영
  2. Person 상세: `"{name}님과의 추억"` 타이틀, 타임라인, 총합/건수/최근 날짜
- **확장 고려**: 향후 Supabase 동기화 유료 기능 추가를 염두에 두고, DB 스키마를 sync-friendly하게 설계한다.

---

## 1) 요구사항 해석

### 1-1. 입력 포맷 및 파싱 규칙
- 기본 포맷: `이름 금액`
- 이름(`name`): 공백 포함 가능성을 고려하되 MVP에서는 마지막 토큰을 금액으로 간주하고 앞부분 전체를 이름으로 파싱
  - 예: `김 철수 10` → name=`김 철수`, amount=10
- 금액(`amount`): 정수(만원 단위)
  - 저장 시 `amount_manwon`(원본 단위)와 `amount_krw`(계산값, 원 단위) 중 최소 하나는 필수
  - MVP에선 계산 및 합산 단순화를 위해 `amount_krw`를 주 저장값으로 사용 (예: 5 → 50000)
- 실패 케이스:
  - 이름 누락, 금액 누락, 숫자 아님, 0 이하
  - UX: 토스트/인라인 에러로 안내, DB 미반영

### 1-2. 도메인 정의
- **Person**: 이름 중심 엔티티(동명이인은 MVP에서 동일 이름 1명으로 취급)
- **Record**: 특정 person에 대한 1건의 경조사비 입력 이벤트
- Soft delete: 실제 삭제 대신 `deleted_at` 기록
- Timestamp: Unix ms INTEGER 사용 (`created_at`, `updated_at`, `deleted_at`)

### 1-3. 화면/동작 해석
- Home
  - Record를 월별(YYYY-MM) 그룹으로 표시
  - 하단 입력바는 항상 접근 가능(sticky), 키보드와 함께 상승
  - 저장 성공 시 입력창 초기화 + 리스트 즉시 갱신
- Person 상세
  - 상단 요약 카드: 총합, 건수, 최근 날짜
  - 하단 타임라인: 최신순 기록

### 1-4. 비기능/아키텍처 제약
- Expo + RN + TS 기반
- DB: expo-sqlite
- 상태관리: 최소 구조 (Zustand 권장)
- 네비게이션: React Navigation
- 오프라인 중심, 동기화 대비 컬럼 필수: `id(UUID)`, `updated_at`, `deleted_at`, `sync_status`

---

## 2) DB 설계 (sync-friendly)

### 2-1. 공통 원칙
- 모든 테이블 PK는 TEXT(UUID)
- Soft delete: `deleted_at` nullable INTEGER
- 동기화 상태: `sync_status` TEXT (`pending` | `synced` | `error`)
- 갱신 시 `updated_at` 변경 필수
- 조회 쿼리는 기본적으로 `deleted_at IS NULL` 조건 포함

### 2-2. 테이블 스키마 초안

#### persons
- `id TEXT PRIMARY KEY` (UUID)
- `name TEXT NOT NULL`
- `name_normalized TEXT NOT NULL` (검색/중복 최소화를 위한 정규화 이름)
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`
- `deleted_at INTEGER NULL`
- `sync_status TEXT NOT NULL DEFAULT 'pending'`

인덱스:
- `idx_persons_name_normalized` on (`name_normalized`) where `deleted_at IS NULL`
- `idx_persons_updated_at` on (`updated_at`)

#### records
- `id TEXT PRIMARY KEY` (UUID)
- `person_id TEXT NOT NULL` (FK → persons.id)
- `raw_input TEXT NOT NULL` (원본 입력 문자열 보존)
- `amount_krw INTEGER NOT NULL` (예: 50000)
- `event_at INTEGER NOT NULL` (기록 발생 시각; MVP에서는 입력 시각)
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`
- `deleted_at INTEGER NULL`
- `sync_status TEXT NOT NULL DEFAULT 'pending'`

인덱스:
- `idx_records_person_id_event_at` on (`person_id`, `event_at` DESC) where `deleted_at IS NULL`
- `idx_records_event_at` on (`event_at` DESC) where `deleted_at IS NULL`
- `idx_records_updated_at` on (`updated_at`)

### 2-3. 정합성/트랜잭션 정책
- 입력 처리 트랜잭션:
  1. person upsert(이름 기준)
  2. record insert
  3. 둘 다 성공 시 commit
- 실패 시 rollback
- FK 활성화: `PRAGMA foreign_keys = ON`

### 2-4. 동기화 대비 확장 포인트
- 서버 동기화 시 `updated_at` 비교 기반 upsert 가능
- Soft delete 전파: `deleted_at` not null 레코드 동기화 대상으로 포함
- 필요 시 추후 `last_synced_at`, `device_id`, `version` 컬럼 추가 가능

---

## 3) 제안 파일 구조 (초기)

```text
/ (repo root)
  App.tsx
  app.json
  package.json
  tsconfig.json
  babel.config.js
  PLANS.md

  src/
    app/
      navigation/
        index.tsx                # NavigationContainer + Stack
      screens/
        HomeScreen.tsx
        PersonScreen.tsx

    components/
      input/
        StickyComposer.tsx       # 하단 입력바
      record/
        RecordList.tsx
        MonthlySection.tsx
      common/
        EmptyState.tsx
        SummaryCard.tsx

    db/
      client.ts                  # sqlite 연결/초기화
      migrations/
        0001_init.sql
      repositories/
        personsRepo.ts
        recordsRepo.ts

    domain/
      models.ts                  # Person, Record 타입
      parser.ts                  # "{name} {amount}" 파서
      format.ts                  # 통화/날짜 포맷

    state/
      useRecordStore.ts          # Zustand store

    services/
      recordService.ts           # 입력→파싱→DB저장 트랜잭션

    hooks/
      useKeyboardInset.ts        # 키보드 높이 반영

    utils/
      time.ts
      uuid.ts
      logger.ts
```

---

## 4) Sprint 계획

## Sprint 0 — 프로젝트 부트스트랩 & 기준선
**목표**: 실행 가능한 Expo+TS 앱 뼈대와 공통 개발 규약 확보.

- 작업 범위
  - Expo TS 프로젝트 생성
  - React Navigation, expo-sqlite, Zustand 의존성 추가
  - 기본 라우팅/스크린 골격 구성
  - lint/format/타입체크 명령 준비
- 산출물
  - 앱 실행/빌드 가능한 초기 구조
  - CI 없이도 로컬 검증 가능한 명령 문서화
- 검증 체크리스트
  - 앱 기동 성공
  - Home/Person 화면 전환 가능
  - 타입체크 통과
- 리스크
  - Expo SDK/라이브러리 버전 호환 이슈

## Sprint 1 — DB 및 도메인 레이어 구축
**목표**: sync-friendly SQLite 스키마 + 저장/조회 repository 완성.

- 작업 범위
  - migration(0001_init.sql) 작성
  - DB 초기화 및 PRAGMA 설정
  - Person/Record repository 구현
  - soft delete 기본 정책 반영
- 작업 순서
  1. 스키마 SQL 작성
  2. DB client + migration runner
  3. repository CRUD/쿼리 작성
  4. 샘플 데이터로 조회 검증
- 검증 체크리스트
  - 테이블/인덱스 생성 확인
  - person upsert 정상
  - record insert + 월별 조회 정상
  - soft delete 후 기본 조회 제외 확인
- 리스크
  - SQLite dialect 제약(부분 인덱스/쿼리 성능)

## Sprint 2 — 입력 파이프라인 & Home 핵심 기능
**목표**: `"{name} {amount}"` 입력→저장→Home 갱신 완성.

- 작업 범위
  - parser(`name`, `amount`) 구현
  - recordService 트랜잭션 구현
  - Home 월별 섹션 리스트 구현
  - sticky 입력바 + 키보드 대응
- 작업 순서
  1. 파서/유효성 검증
  2. service 트랜잭션
  3. Zustand store 연결
  4. Home UI + 즉시 갱신
- 검증 체크리스트
  - 정상 입력 저장/렌더링
  - 비정상 입력 에러 처리
  - 키보드 표시 시 입력바 위치 정상
  - 연속 입력 시 성능/중복 이상 없음
- 리스크
  - 한글 이름/공백 처리 엣지케이스
  - keyboard avoiding 동작의 OS별 차이(iOS/Android)

## Sprint 3 — Person 상세 화면
**목표**: 인물별 히스토리 타임라인과 요약 지표 제공.

- 작업 범위
  - Home→Person 네비게이션 연결
  - Person별 summary 집계(SUM/COUNT/MAX(event_at))
  - 타임라인 리스트 최신순 구현
- 작업 순서
  1. personId/name 파라미터 설계
  2. 상세 쿼리(요약/목록) 구현
  3. 화면 컴포넌트 구성
- 검증 체크리스트
  - 타이틀 `"{name}님과의 추억"` 정확 표시
  - 총합/건수/최근일 계산 정확
  - 데이터 없음 상태(Empty) 처리
- 리스크
  - 집계 쿼리와 목록 쿼리 간 시점 불일치

## Sprint 4 — 품질 보강 & 출시 준비(MVP)
**목표**: 안정성, 유지보수성, 향후 sync 연계를 위한 정리.

- 작업 범위
  - 에러 처리/로그 정리
  - 간단 테스트(파서/서비스/쿼리) 보강
  - 데이터 마이그레이션 전략 문서화
  - 릴리즈 체크(아이콘/권한/앱 메타)
- 검증 체크리스트
  - 핵심 유즈케이스 회귀 테스트 통과
  - 예외 케이스에서 앱 크래시 없음
  - sync 확장 포인트 문서화 완료
- 리스크
  - 테스트 환경에서 SQLite mocking 난이도

---

## 5) 작업 순서 (전체 관점)
1. Sprint 0으로 실행 가능한 골격 확보
2. Sprint 1에서 데이터 정합성 우선 확보
3. Sprint 2에서 핵심 UX(빠른 입력) 완성
4. Sprint 3으로 조회 경험(상세 맥락) 제공
5. Sprint 4에서 품질/출시 안정화

---

## 6) MVP 검증 체크리스트 (통합)
- [ ] `"홍길동 5"` 입력 시 record 저장 + Home 즉시 반영
- [ ] 월별 그룹이 최신 월부터 정렬 표시
- [ ] 같은 이름 재입력 시 동일 person에 누적
- [ ] Person 상세에서 총합/건수/최근 날짜 정확
- [ ] soft delete 데이터가 기본 목록에서 제외
- [ ] 모든 timestamp가 Unix ms INTEGER
- [ ] 모든 테이블에 `id`, `updated_at`, `deleted_at`, `sync_status` 존재
- [ ] 앱 재실행 후 로컬 데이터 유지

---

## 7) 주요 리스크 및 대응
- **이름 중복(동명이인) 문제**
  - MVP: 이름 단일 식별로 단순화
  - 대응: 추후 person 병합/분리 UX 또는 별칭/메모 도입
- **입력 파싱 모호성**
  - MVP: 마지막 토큰 숫자 규칙 고정
  - 대응: 실패 시 즉시 피드백 + 포맷 힌트 제공
- **키보드/입력바 레이아웃 이슈**
  - 대응: 플랫폼별 KeyboardAvoidingView + safe area 테스트
- **향후 sync 충돌 처리**
  - 대응: `updated_at` 기반 last-write-wins를 1차 전략으로 문서화

---

## 8) 완료 정의(Definition of Done, MVP)
- 필수 화면(Home/Person) 동작
- 핵심 입력 플로우 저장/조회 안정화
- sync-friendly 스키마 강제
- 주요 엣지케이스(파싱 실패, 빈상태, soft delete) 처리
- 최소 테스트/체크리스트 통과 및 문서 정리 완료
