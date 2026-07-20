import { Route, Routes } from "react-router-dom";

import { LegacyAdminPage } from "./admin/LegacyAdminPage.jsx";
import { LegacyAuthPage } from "./auth/LegacyAuthPage.jsx";
import { RedirectRoute } from "./shared/routing/RedirectRoute.jsx";
import { LegacyLearnerPage } from "./learner/LegacyLearnerPage.jsx";
import { LegacyPasswordResetPage } from "./auth/LegacyPasswordResetPage.jsx";

const learnerRoutes = [
  "/home/",
  "/year/",
  "/modules/",
  "/subtopics/",
  "/types/",
  "/quizzes/",
  "/setup/",
  "/quiz/",
  "/results/",
  "/account/",
  "/settings/",
  "/past-papers/",
  "/past-papers/exams/",
  "/past-papers/session/",
  "/past-papers/review/",
];

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LegacyAuthPage />} />
      <Route path="/update-password/" element={<LegacyPasswordResetPage />} />
      {learnerRoutes.map((path) => (
        <Route key={path} path={path} element={<LegacyLearnerPage />} />
      ))}
      <Route path="/JAK2V617F/" element={<LegacyAdminPage page="home" />} />
      <Route
        path="/JAK2V617F/stats/"
        element={<LegacyAdminPage page="stats" />}
      />
      <Route
        path="/JAK2V617F/access-control/"
        element={<LegacyAdminPage page="access" />}
      />
      <Route path="/admin/" element={<RedirectRoute to="/" />} />
      <Route path="/admin.html" element={<RedirectRoute to="/" />} />
      <Route path="/app.html" element={<RedirectRoute to="/home/" />} />
      <Route path="/dashboard/" element={<RedirectRoute to="/home/" />} />
      <Route path="*" element={<RedirectRoute to="/" />} />
    </Routes>
  );
}
