# Design

## Source of truth

- Status: Active. Last refreshed: 2026-11-05.
- Primary product surfaces: 로그인, 공유 캘린더, 학습 목록, 영단어 퀴즈, 공유함.
- Evidence reviewed: 사용자 요구사항과 첨부 커리큘럼, 기존 UI, nodit 리브랜딩 및 전체 일정 표시 요청.

## Brand

- Personality: 간결한 스터디 관리 도구. 중립적이고 명확한 한국어.
- Name: 노딧 / nodit. — Node + Do it. 노드 팀의 학습 계획과 기록 도구.
- Logo: 소문자 nodit. 워드마크와 선으로 그린 펜 아이콘. 나뭇잎은 사용하지 않는다.
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
- Tradeoffs: PC와 모바일 모두 월간 달력에서 모든 일정의 이름과 작성자를 표시한다. 날짜의 높이는 내용에 따라 늘어나며 +n 접기는 사용하지 않는다.
- 영단어 퀴즈: 하나 이상의 묶음 선택 → 전체 무작위 출제 → 4지선다 응답 → 정답 확인 → 결과·오답 재출제. 시간 제한과 순위를 두지 않는다. 오답 보기에도 최초 선택 묶음의 단어를 사용한다.
- 공유함 댓글: 기존 게시글 박스 안에서 댓글 목록을 항상 표시하고, 입력창은 “댓글 쓰기” 버튼을 누르면 펼친다. 이름 오른쪽에 옅은 날짜·시간을 표시하며 게시글 작성자 정보보다 작게 배치한다. 오래된 작성 시각부터 표시하고 수정해도 순서는 바뀌지 않는다. 본인의 댓글에만 수정·삭제를 제공하며 삭제는 확인 대화상자를 사용한다. 댓글 등록에 성공하면 입력창을 닫고, 요청 실패 또는 입력창을 잠시 닫을 때에는 작성 내용을 보존한다. 게시글 삭제 시 댓글도 함께 삭제됨을 안내한다. 댓글은 최대 1,000자다.
- 공유함 이미지: 글당 JPEG·PNG·WebP 이미지 1장(최대 2MB)을 선택 첨부한다. 작성·수정 화면에서 미리보기와 교체·삭제를 제공하고 저장 후 반영한다. 게시글에서는 원본 비율을 유지해 표시하고 새 탭에서 크게 볼 수 있다. 로그인한 구성원만 조회하며 실패하면 본문과 선택 파일을 보존한다. 모바일에서도 가로 넘침 없이 표시한다.

## Visual language

- Color: warm ivory #fcfaf5, ink #342c1c, gold #8a620e, gold highlight #e6b94b, gold soft #fbf2d8, subtle borders #e9e2d3. 밝은 골드 배경에는 짙은 글자를 사용한다.
- Member colors: 도현 gold, 예은 terracotta, 지은 violet. 저장된 green 색상 이름은 호환성을 위해 유지하되 시각 표현은 골드로 바꾼다. 이름을 항상 병기한다.
- Typography: 시스템 한국어 sans-serif, 본문 14~15px, 제목 26~30px.
- Spacing/layout rhythm: 4px 단위, 콘텐츠 최대 1200px, 모바일 여백 18px.
- Shape/radius/elevation: 12~16px 반경, 테두리 중심, 대화상자에만 그림자.
- Motion: 짧은 색상 전환. 불필요한 이동 애니메이션 없음.
- Imagery/iconography: 일관된 1.7px 선 아이콘. 장식용 이미지 없음.

## Components

- Existing components to reuse: 없음.
- New/changed components: AppShell, Icon, Calendar, TodoEditor, Dialog, CurriculumList, VocabularyQuiz, SharedBoard, PostComments.
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
- Layout adaptations: PC 달력+오른쪽 목록; 모바일 전체 일정을 보여주는 달력+아래 목록, 하단 내비게이션. 긴 일정 제목은 줄바꿈한다.
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
- Microcopy rules: 기능 설명, 입력 안내, 상태 및 오류 메시지를 명확하게 적는다. 이번에 지정한 로그인 “노딧에서 오늘의 공부를 시작해요.”, 캘린더 “우리의 학습 기록”, 퀴즈 “오늘도 노딧!”만 브랜드 문구로 적용하고 추가 슬로건을 만들지 않는다.

## Implementation constraints

- Framework/styling system: Next.js App Router, TypeScript, plain CSS.
- Design-token constraints: globals.css에 색상과 간격의 기준을 모은다.
- Performance constraints: 불필요한 UI 의존성이나 외부 폰트를 추가하지 않는다.
- Compatibility constraints: 한국 시간, 날짜 단위 일정, yymmdd 로그인.
- Test/screenshot expectations: 360px 모바일과 PC에서 실제 브라우저 QA.

## Open questions

- 운영 지연은 Vercel 함수 리전과 Supabase 리전·네트워크의 영향을 받는다. 코드상 조회 횟수 개선과 실제 운영 응답 시간은 구분해 검증한다.
