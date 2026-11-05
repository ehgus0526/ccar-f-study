import VocabularyQuiz from "@/components/VocabularyQuiz";
import { pageMember } from "@/lib/auth";

export default async function QuizPage() {
  await pageMember();
  return <VocabularyQuiz />;
}
