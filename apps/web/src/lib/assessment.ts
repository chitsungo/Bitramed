export type Question = {
  key: string;
  text: string;
  answer: string;
  explanation: string;
  imageUrl: string;
  options: string[];
  type: "sba" | "tf";
};

export type AssessmentResult = {
  score: number;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  percentage: number;
  items: Array<{
    question: Question;
    userAnswer: string;
    correctAnswer: string;
    correct: boolean;
    points: number;
  }>;
};

export function normalizeAnswer(value: unknown, type: "sba" | "tf") {
  const answer = String(value || "")
    .trim()
    .toUpperCase();
  if (type === "tf") {
    if (["TRUE", "T", "1", "YES"].includes(answer)) return "TRUE";
    if (["FALSE", "F", "0", "NO"].includes(answer)) return "FALSE";
  }
  return answer;
}

export function scoreAssessment(
  questions: Question[],
  answers: Record<string, string>,
  negativeMarking: boolean
): AssessmentResult {
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  const items = questions.map((question) => {
    const userAnswer = normalizeAnswer(answers[question.key], question.type);
    const expected = normalizeAnswer(question.answer, question.type);
    const isCorrect = Boolean(userAnswer) && userAnswer === expected;
    let points = 0;
    if (!userAnswer) unanswered += 1;
    else if (isCorrect) {
      correct += 1;
      points = 1;
    } else {
      wrong += 1;
      points = negativeMarking ? -1 : 0;
    }
    score += points;
    return {
      question,
      userAnswer,
      correctAnswer: expected,
      correct: isCorrect,
      points,
    };
  });
  return {
    score,
    total: questions.length,
    correct,
    wrong,
    unanswered,
    percentage: questions.length
      ? Math.round((Math.max(score, 0) / questions.length) * 100)
      : 0,
    items,
  };
}
