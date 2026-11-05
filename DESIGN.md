# Design

## Source of truth

- Status: Active. Last refreshed: 2026-11-05.
- Primary product surfaces: 로그인, 공유 캘린더, 학습 목록, 영단어 퀴즈, 공유함.
- Evidence reviewed: 사용자 요구사항과 첨부 커리큘럼, 합의한 구현 계획. 기존 UI와 디자인 자산 없음.

## Brand

- Personality: 간결한 스터디 관리 도구. 중립적이고 명확한 한국어.
- Trust signals: 작성자 이름, 저장 결과, 명확한 완료 상태.
- Avoid: 감성 문구, 동기 부여 문구, 장식용 영문 제목, 순위, 과도한 카드 중첩, 장식 이미지.

## Product goals

- Goals: 세 사람이 계획을 등록하고 서로 학습을 확인하며 완료를 인증한다.
- Non-goals: LMS 재구현, 자동 학습 연동, 알림, 자동 반복, 관리자 화면.
- Success signals: 모바일에서 날짜 선택과 일정 완료를 바로 처리한다.

## Personas and jobs

- Primary personas: 도현, 예은, 지은. 약 한 달간 사용하는 3인 스터디.
- User jobs: 계획 세우기, 함께 확인하기, 학습 인증, 짧은 자료 공유.
- Key contexts of use: 모바일 짧은 확인과 PC 계획 작성.

## Information architecture

- Primary navigation: 캘린더, 학습 목록, 영단어 퀴즈, 공유함.
- Core routes/screens: /login, /, /curriculum, /quiz, /shared.
- Content hierarchy: 오늘과 이번 달 → 사람별 계획 → 완료 기록.

## Design principles

- 달력과 일정이 화면의 중심이다.
- 작은 입력으로 끝낸다. 사진과 메모는 선택이다.
- Tradeoffs: 모바일 달력에는 사람 표시만, 상세는 날짜 목록에 둔다.
- 영단어 퀴즈: 하나 이상의 묶음 선택 → 전체 무작위 출제 → 4지선다 응답 → 정답 확인 → 결과·오답 재출제. 시간 제한과 순위를 두지 않는다. 오답 보기에도 최초 선택 묶음의 단어를 사용한다.

## Visual language

- Color: ivory #f8f9f6, ink #253c32, green #49735c, subtle borders #e5e9e3.
- Member colors: 도현 green, 예은 terracotta, 지은 violet. 이름을 항상 병기한다.
- Typography: 시스템 한국어 sans-serif, 본문 14~15px, 제목 26~30px.
- Spacing/layout rhythm: 4px 단위, 콘텐츠 최대 1200px, 모바일 여백 18px.
- Shape/radius/elevation: 12~16px 반경, 테두리 중심, 대화상자에만 그림자.
- Motion: 짧은 색상 전환. 불필요한 이동 애니메이션 없음.
- Imagery/iconography: 일관된 1.7px 선 아이콘. 장식용 이미지 없음.

## Components

- Existing components to reuse: 없음.
- New/changed components: AppShell, Icon, Calendar, TodoEditor, Dialog, CurriculumList, VocabularyQuiz, SharedBoard.
- Variants and states: 선택 날짜, 오늘, 완료, 비어 있음, 저장 중, 오류.
- Token/component ownership: globals.css 토큰과 공통 컴포넌트.

## Accessibility

- Target standard: WCAG AA를 목표로 의미 있는 HTML과 명확한 이름을 사용한다.
- Keyboard/focus behavior: 보이는 포커스, 대화상자 포커스 이동·복귀·순환, Escape 닫기.
- Contrast/readability: 흐린 작은 글씨를 최소화하고 색상만으로 정보를 전달하지 않는다.
- Screen-reader semantics: 버튼 이름, 날짜 이름, 입력 라벨, 상태 알림.
- Reduced motion and sensory considerations: prefers-reduced-motion 지원.

## Responsive behavior

- Supported breakpoints/devices: 360px부터 PC. 760px에서 모바일 레이아웃 전환.
- Layout adaptations: PC 달력+오른쪽 목록; 모바일 작은 달력+아래 목록, 하단 내비게이션.
- 영단어 퀴즈: 모바일 하단 메뉴 4열, 묶음 선택 2열, 답안과 다음 버튼은 세로 배치. 정답·오답은 색상과 문구·아이콘으로 함께 표시한다.
- Touch/hover differences: 핵심 버튼 44px 이상, hover에만 숨기는 기능 없음.

## Interaction states

- Loading: 버튼 비활성화, 저장 중 문구.
- Empty: 다음 행동을 안내하는 짧은 문구와 추가 버튼.
- Error: 입력을 보존하고 구체적인 오류와 재시도를 안내한다.
- Success: 서버 저장 후 UI 갱신, aria-live 메시지.
- Disabled: 중복 제출 방지.
- Offline/slow network: 마지막 기록을 지우지 않고 실패 상태를 안내한다.

## Content voice

- Tone: 짧고 중립적인 안내 문장.
- Terminology: 일정, 완료, 학습 목록, 공유함.
- Microcopy rules: 기능 설명, 입력 안내, 상태 및 오류 메시지만 명확하게 적는다. 감성적인 슬로건이나 응원 문구를 넣지 않는다.

## Implementation constraints

- Framework/styling system: Next.js App Router, TypeScript, plain CSS.
- Design-token constraints: globals.css에 색상과 간격의 기준을 모은다.
- Performance constraints: 불필요한 UI 의존성이나 외부 폰트를 추가하지 않는다.
- Compatibility constraints: 한국 시간, 날짜 단위 일정, yymmdd 로그인.
- Test/screenshot expectations: 360px 모바일과 PC에서 실제 브라우저 QA.

## Open questions

- 운영 계정 연결: Supabase·Vercel 자격 증명은 제공되지 않음. 로컬 SQLite로 검증하고 운영 연결 절차를 문서화한다.
