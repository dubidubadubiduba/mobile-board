# Mobile Board

파트원들의 **점심 · 근태 · 이벤트 · 메모**를 한 달력에서 함께 관리하는 팀 스케줄러.

## 기능

### 1. 🍚 점심 멤버 표시
- 날짜 칸당 최대 9명 (3×3 그리드, 각자 고유 배경색)
- **데스크톱**: 사이드바에서 팀원 이름 클릭 → 달력 셀 클릭으로 배치 / 셀 위 이름 다시 클릭 시 제외
- **모바일**: 셀 탭 → 하단 시트에서 참석자 토글
- 월 단위 **전체 채우기 / 전체 빼기** 지원

### 2. 🗓️ 근태 등록 (교육 / 휴가 / 출장)
- 팀원 · 유형 · 시작일 · 종료일 지정 → 여러 날 자동으로 이어지는 바로 표시
- 바 색상은 **멤버 색**, 라벨은 `아이콘 이름 · 유형` (예: `🏝️ 김철수 · 휴가`)
- 사이드바에서 등록된 항목 목록 확인 및 삭제 가능

### 3. 🎉 파트 이벤트 (회식 등)
- 제목 · 색 · 시작일 · 종료일 지정
- 근태와 같은 방식으로 여러 날 연속 바로 표시 (점선 테두리로 근태와 구분)
- 사이드바에서 등록된 이벤트 목록 확인 및 삭제 가능

### 4. 📝 메모장
- 팀원 지정(또는 익명) + 한 줄 메모, 즉시 저장
- 최대 100개까지 유지

### 그 외
- 셀 클릭(팀원 미선택 상태) → **상세 모달**로 그 날의 이벤트 · 근태 · 점심 참석자 확인
- 셀당 바 개수 제한 없음, 셀 내부에서 세로 스크롤
- 주말·공휴일 배경 강조, 사내 지정 **Family Day** 배지 표시
- **낙관적 동시성 제어** — 다른 사람이 먼저 저장한 경우 덮어쓰지 않고 새로고침 안내

## 데이터 모델

```js
{
  members:    [{ id, name, color }],
  schedule:   { 'YYYY-MM-DD': [memberId, ...] },   // 점심 참석
  attendance: [{ id, memberId, type, start, end }], // type: 'vacation'|'training'|'trip'
  events:     [{ id, title, color, start, end }],
  memos:      [{ id, ts, author, color, text }],
  version:    number                                 // 동시성 제어용
}
```

새 필드(`attendance`, `events`)는 `getState()`에서 기본값과 병합되므로 기존 데이터와 호환됩니다.

## 로컬 실행

```bash
npm install
npm run dev
```

> Termux/Android 등 Turbopack 네이티브 바인딩이 없는 환경에서는:
> ```bash
> npx next dev --webpack
> ```

Upstash Redis 환경변수가 없으면 `/tmp` 파일에 저장되어 로컬에서도 즉시 동작합니다.

## Vercel 배포

1. 이 저장소를 [Vercel](https://vercel.com/new)에서 **Import**
2. Storage 탭에서 **Upstash Redis** 스토어를 생성해 프로젝트에 **Connect**
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 자동 주입
3. **Deploy**

기존 스토어에 저장된 데이터는 이번 리브랜딩·기능 추가 후에도 그대로 유지됩니다 (스키마는 추가만, 수정·삭제 없음).

## 스택

Next.js 16 (App Router) · React 19 · Upstash Redis
