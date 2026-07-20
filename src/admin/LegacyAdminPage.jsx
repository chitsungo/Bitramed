import { useEffect, useMemo } from "react";

import adminAccessHtml from "../legacy/templates/admin/access-control.html?raw";
import adminHomeHtml from "../legacy/templates/admin/home.html?raw";
import adminStatsHtml from "../legacy/templates/admin/stats.html?raw";
import { adminApp } from "../legacy/apps/admin-app.js";
import {
  applyLegacyDocumentShell,
  parseLegacyDocument,
} from "../shared/dom/legacyDocument.js";

const adminHtmlByPage = {
  access: adminAccessHtml,
  home: adminHomeHtml,
  stats: adminStatsHtml,
};

export function LegacyAdminPage({ page }) {
  const legacyDocument = useMemo(
    () => parseLegacyDocument(adminHtmlByPage[page] || adminHomeHtml),
    [page]
  );

  useEffect(() => {
    applyLegacyDocumentShell(legacyDocument);
    void adminApp.init();
  }, [legacyDocument]);

  return <div dangerouslySetInnerHTML={{ __html: legacyDocument.bodyHtml }} />;
}
