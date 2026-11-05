import type { CurriculumItem, Member } from "./types.ts";

export const MEMBERS: Member[] = [
  { id: "dohyeon", name: "도현", color: "green" },
  { id: "yeeun", name: "예은", color: "orange" },
  { id: "jieun", name: "지은", color: "purple" },
];
export const LMS_URL = "https://ccarf-lms.evolver.club/dashboard";
export const KIND_LABELS = {
  video: "영상 강의",
  workbook: "워크북",
  vocab: "영단어",
};
const chapters = [
  [
    "에이전트 아키텍처와 오케스트레이션",
    [
      "에이전트와 워크플로, Claude API 기초",
      "작업 분해와 계획",
      "멀티 에이전트 오케스트레이션",
      "신뢰성과 사람의 감독",
    ],
  ],
  [
    "도구 설계와 MCP 통합",
    ["도구 설계의 기본", "MCP 서버 만들기", "MCP 운영과 내장 도구"],
  ],
  [
    "Claude Code 설정과 워크플로",
    [
      "Claude Code 구조와 기본 설정",
      "CLAUDE.md 설정",
      "슬래시 명령, 스킬, 서브에이전트",
      "훅, SDK, CI/CD",
    ],
  ],
  [
    "프롬프트 엔지니어링과 구조화 출력",
    ["효과적인 프롬프트 작성", "고급 프롬프트 기법", "구조화 출력과 평가"],
  ],
  [
    "컨텍스트 관리와 신뢰성",
    [
      "컨텍스트 윈도",
      "멀티 에이전트 실패 유형",
      "세션 간 지식과 일관성",
      "신뢰도, 샘플링, 출처",
    ],
  ],
] as const;
export const CURRICULUM: CurriculumItem[] = [
  ...[
    "영어 시험을 끝까지 읽어 내는 법",
    "에이전트·도구가 영어 문항에서 나오는 모습",
    "Claude Code의 영어",
    "프롬프트·컨텍스트의 영어와 모의고사 120분",
  ].map((title, i) => ({
    id: `video-${i + 1}`,
    kind: "video" as const,
    code: `${i + 1}편`,
    title,
  })),
  ...chapters.flatMap(([chapter, lessons], ci) =>
    lessons.map((title, li) => ({
      id: `workbook-${ci + 1}-${li + 1}`,
      kind: "workbook" as const,
      code: `${ci + 1}-${li + 1}`,
      title,
      chapter: `CH${ci + 1} · ${chapter}`,
    })),
  ),
  ...["A-1", "A-2", "A-3", "A-4"].map((code, i) => ({
    id: `vocab-${i + 1}`,
    kind: "vocab" as const,
    code,
    title: `필수 영단어 ${code}`,
  })),
];
export function getMember(id: string) {
  return MEMBERS.find((member) => member.id === id);
}
