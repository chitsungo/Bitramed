import { learnerCore } from "../apps/learner-core.js";
import { learnerFeatures } from "../apps/learner-features.js";
import { learnerSearch } from "../apps/learner-search.js";
import { renderLearnerShell } from "../views/learner-layout.js";

function createInitialState() {
  return JSON.parse(JSON.stringify(learnerCore.state));
}

function createLearnerApp() {
  return {
    ...learnerCore,
    ...learnerFeatures,
    ...learnerSearch,
    state: createInitialState()
  };
}

async function start() {
  renderLearnerShell();
  const learnerApp = createLearnerApp();
  await learnerApp.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void start();
  }, { once: true });
} else {
  void start();
}
