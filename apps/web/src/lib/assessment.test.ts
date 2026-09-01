import { describe, expect, it } from "vitest";
import { normalizeAnswer, scoreAssessment, type Question } from "./assessment";

const questions: Question[] = [
  {
    key: "one",
    text: "Statement one",
    answer: "TRUE",
    explanation: "",
    imageUrl: "",
    options: ["TRUE", "FALSE"],
    type: "tf",
  },
  {
    key: "two",
    text: "Question two",
    answer: "B",
    explanation: "",
    imageUrl: "",
    options: ["A", "B"],
    type: "sba",
  },
  {
    key: "three",
    text: "Statement three",
    answer: "FALSE",
    explanation: "",
    imageUrl: "",
    options: ["TRUE", "FALSE"],
    type: "tf",
  },
];

describe("assessment scoring", () => {
  it("normalizes common true and false values", () => {
    expect(normalizeAnswer("yes", "tf")).toBe("TRUE");
    expect(normalizeAnswer("0", "tf")).toBe("FALSE");
  });

  it("keeps wrong answers at zero in standard mode", () => {
    const result = scoreAssessment(questions, { one: "true", two: "A" }, false);
    expect(result).toMatchObject({
      score: 1,
      correct: 1,
      wrong: 1,
      unanswered: 1,
      percentage: 33,
    });
  });

  it("subtracts wrong answers but never reports a negative percentage", () => {
    const result = scoreAssessment(
      questions,
      { one: "false", two: "A", three: "true" },
      true
    );
    expect(result).toMatchObject({
      score: -3,
      correct: 0,
      wrong: 3,
      unanswered: 0,
      percentage: 0,
    });
  });
});
