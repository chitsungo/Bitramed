import { useEffect, useMemo } from "react";

import authHtml from "../legacy/templates/auth/index.html?raw";
import { authApp } from "../legacy/apps/auth-app.js";
import {
  applyLegacyDocumentShell,
  parseLegacyDocument,
} from "../shared/dom/legacyDocument.js";

export function LegacyAuthPage() {
  const legacyDocument = useMemo(() => parseLegacyDocument(authHtml), []);

  useEffect(() => {
    applyLegacyDocumentShell(legacyDocument);
    void authApp.init();
  }, [legacyDocument]);

  return <div dangerouslySetInnerHTML={{ __html: legacyDocument.bodyHtml }} />;
}
