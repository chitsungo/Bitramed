import { useEffect } from "react";

import { learnerCore } from "../legacy/apps/learner-core.js";
import { learnerFeatures } from "../legacy/apps/learner-features.js";
import { learnerSearch } from "../legacy/apps/learner-search.js";
import { pastPaperApp } from "../legacy/features/past-papers/past-paper-app.js";
import { renderLearnerShell } from "../legacy/views/learner-layout.js";

const pageByPath = new Map([
  ["/home/", "home"],
  ["/year/", "year"],
  ["/modules/", "modules"],
  ["/subtopics/", "subtopics"],
  ["/types/", "types"],
  ["/quizzes/", "quizzes"],
  ["/setup/", "setup"],
  ["/quiz/", "quiz"],
  ["/results/", "results"],
  ["/account/", "account"],
  ["/settings/", "settings"],
  ["/past-papers/", "past-paper-topics"],
  ["/past-papers/exams/", "past-paper-exams"],
  ["/past-papers/session/", "past-paper-session"],
  ["/past-papers/review/", "past-paper-review"],
]);

function createInitialState() {
  return JSON.parse(JSON.stringify(learnerCore.state));
}

function createLearnerApp() {
  return {
    ...learnerCore,
    ...learnerFeatures,
    ...learnerSearch,
    ...pastPaperApp,
    state: createInitialState(),
  };
}

export function LegacyLearnerPage() {
  useEffect(() => {
    document.body.className = "app-page";
    document.body.dataset.appPage =
      pageByPath.get(window.location.pathname) || "home";
    renderLearnerShell();
    const app = createLearnerApp();
    void app.init();
  }, []);

  return <div id="app-route-root" />;
}
