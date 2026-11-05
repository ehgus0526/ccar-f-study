export const VOCABULARY_GROUP_IDS = ["A-1", "A-2", "A-3", "A-4"] as const;
export type VocabularyGroupId = (typeof VOCABULARY_GROUP_IDS)[number];
export type VocabularyWord = {
  id: string;
  group: VocabularyGroupId;
  term: string;
  meaning: string;
};

// User-provided CCAR-F glossary. Keep the original wording and group boundaries.
const source: Record<VocabularyGroupId, string> = {
  "A-1": `without ~ing : ~하지 않고
What is the most effective ~? : 가장 효과적인 ~은?
while preserving ~ : ~을 유지하면서
most reliably : 가장 확실하게
What is the most likely ~? : 가장 유력한 ~은?
root cause : 근본 원인
most appropriate : 가장 적절한
What should you do first? : 먼저 할 일은?
What should you change? : 무엇을 바꿔야 하나?
Which approach best ~? : 가장 ~한 접근은?
What should you do next? : 다음에 할 일은?
going forward : 앞으로, 향후
How should ~ be (re)designed? : 어떻게 (재)설계할까?
correct approach : 올바른 접근법
the best next step : 가장 좋은 다음 단계
request : 요청(하다)
instruct : 지시하다
whenever : ~할 때마다
confirm : 확인해 주다, 입증하다
rewrite : 고쳐 쓰다
identical : 똑같은, 동일한
approximately : 약, 대략
currently : 현재
rely : 의존하다, 기대다
repeat : 되풀이하다
prevent : 막다, 방지하다
implement : 구현하다, 도입하다
reliably : 확실하게
specify : 명시하다
consistently : 일관되게, 매번
later : 이후의, 나중에
inspect : 살펴보다, 점검하다
infer : 추론하다, 짐작하다
detect : 감지하다
plus : ~에 더해
valid : 유효한, 올바른
correctly : 올바르게, 정확히
enable : 켜다; 가능하게 하다
prior : 이전의
expand : 늘리다, 확장하다
logic : 로직, 처리 규칙
omit : 빠뜨리다, 생략하다
evaluation : 평가
independent : 독립된, 별개의
layer : 계층, 중간 단계
raw : 가공 안 한 원본의
scan : 훑어 검사하다
publish : 게시하다, 내보내다
sentence : 문장
module : 모듈(코드 묶음 단위)
legacy : 오래된 기존(레거시)
append : 끝에 덧붙이다
merge : 병합하다, 합치다
timeout : 시간 초과
transcript : 대화 기록(전문)`,
  "A-2": `handle : 처리하다, 다루다
directly : 직접, 곧바로
refund : 환불(하다)
text : 글, 텍스트
billing : 결제·청구
verify : 확인하다, 검증하다
synthesis : 종합(결과 합치기)
resolve : 해결하다
investigation : 조사
trace : 실행 기록 / 추적하다
entire : 전체의, 통째로
content : 내용(물)
additional : 추가의
dispute : 분쟁, 이의 제기
delegate : 맡기다, 위임하다
internal : 내부의, 사내의
retrieve : 가져오다, 불러오다
select : 고르다, 선택하다
expose : (기능을) 제공하다
register : 등록하다
investigate : 조사하다
validate : 검증하다
appropriate : 적절한, 알맞은
analyze : 분석하다
follow-up : 후속(요청·질문)
declare : 선언하다, (스키마에) 명시하다
enforce : 강제로 적용하다
exceed : 넘다, 초과하다
occasionally : 가끔, 이따금
sequence : 순서, 차례
parallel : 병렬의, 동시에 도는
reply : 답변(하다)
synthesize : 종합하다, 합치다
consume : 소비하다, 받아 쓰다
terminate : 종료하다, 끝내다
independently : 독립적으로, 따로
succeed : 성공하다
deliver : 배송하다; 전달하다
spawn : (하위 에이전트를) 띄우다, 생성하다
configure : 설정하다, 구성하다
web : 웹(인터넷)
lookup : 조회
backend : 백엔드(서버 쪽)
handler : 처리 함수(핸들러)
branch : 갈래, 분기
platform : 플랫폼(공통 기반)
ticket : 티켓(문의 접수 건)
deployment : 배포(운영 환경에 올리기)`,
  "A-3": `generate : 생성하다, 만들어 내다
automatically : 자동으로
automate : 자동화하다
update : 갱신하다, 고치다
explicitly : 명시적으로, 분명히
convention : 규칙, 관례
modify : 수정하다, 바꾸다
modification : 수정(안), 변경
relevant : 관련 있는, 해당하는
implementation : 구현
inconsistent : 일관성 없는, 들쭉날쭉
subsequent : 그다음의, 이후의
requirement : 요구 사항, 조건
duplicate : 중복된
frequently : 자주
consolidate : 하나로 합치다
integrate : 통합하다, 연동하다
approve : 승인하다
senior : 선임의, 경력 많은
guidance : 지침, 안내
ignore : 무시하다
draft : 초안
eliminate : 없애다, 제거하다
copy : 복사하다
consistent : 일관된
launch : 실행하다, 띄우다
restrict : 제한하다, 한정하다
accumulate : 쌓이다, 누적되다
examine : 살펴보다, 검토하다
teammate : 팀원, 동료
exploration : 탐색
feedback : 피드백, 의견
location : 위치
repository : 저장소(레포)
invoke : 호출하다, 실행시키다
codebase : 코드베이스(전체 코드)
configuration : 설정, 구성
load : 불러오다, (규칙·파일이) 로드되다
execute : 실행하다
execution : 실행
commit : 커밋하다, 올리다
invocation : 호출(1회 실행)
directory : 디렉터리(폴더)
database : 데이터베이스
migration : 마이그레이션(이전)
string : 문자열
diff : 변경분(diff)
script : 스크립트(명령을 적어 두고 돌리는 작은 프로그램)
package : 패키지(하위 프로젝트)
nightly : 매일 밤의, 야간
documentation : 문서(화), 설명 자료
frontmatter : 프런트매터(머리 설정)`,
  "A-4": `summary : 요약(본)
flag : 지적하다, 표시하다
correct : 바로잡다, 고치다
effective : 효과적인
extract : 추출하다, 뽑아내다
category : 범주, 분류
reject : 거부하다, 반려하다
earlier : 앞서 나온, 이전의
downstream : 후속 단계의
preserve : 보존하다, 지키다
unchanged : 바뀌지 않은, 그대로인
cite : 인용하다, 출처 달다
effectively : 효과적으로
retain : 유지하다, 남겨 두다
label : (정답) 라벨을 붙이다
payment : 결제, 지급
skip : 건너뛰다, 넘기다
switch : 바꾸다, 전환하다
alongside : ~와 함께, ~ 곁에
entirely : 완전히, 아예
attach : 붙이다, 첨부하다
entry : 항목, 기록 한 건
accurate : 정확한
exact : 정확한, 그대로의
larger : 더 큰
prose : 줄글(형식 없는 문장)
discard : 버리다, 폐기하다
invoice : 청구서, 송장
submit : 제출하다, 보내다
fresh : 새로운, 깨끗한
pilot : 시범 운영
roughly : 대략, 약
edge : 예외적 경우
wording : 표현, 문구
topic : 주제
resume : 이어서 하다, 재개하다
dismiss : 무시하다, 기각하다
identifier : 식별자(ID)
rerun : 다시 실행하다
null : 널(값 없음)
parse : 파싱하다, 해석하다
batch : 일괄 처리(묶음)
import : (모듈) 불러오기
refactor : 리팩터링
validator : 검증기`,
};

export const VOCABULARY_GROUPS = VOCABULARY_GROUP_IDS.map((group) => ({
  id: group,
  words: source[group].split("\n").map((line, index): VocabularyWord => {
    const separator = line.indexOf(" : ");
    return {
      id: `${group.toLowerCase()}-${index + 1}`,
      group,
      term: line.slice(0, separator),
      meaning: line.slice(separator + 3),
    };
  }),
}));

export const VOCABULARY = VOCABULARY_GROUPS.flatMap((group) => group.words);

export function selectedVocabulary(groups: readonly VocabularyGroupId[]) {
  return VOCABULARY.filter((word) => groups.includes(word.group));
}
