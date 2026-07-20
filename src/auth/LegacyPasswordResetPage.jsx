import { useEffect, useMemo } from "react";

import passwordResetHtml from "../legacy/templates/auth/update-password.html?raw";
import { passwordResetApp } from "../legacy/apps/password-reset-app.js";
import {
  applyLegacyDocumentShell,
  parseLegacyDocument,
} from "../shared/dom/legacyDocument.js";

export function LegacyPasswordResetPage() {
  const legacyDocument = useMemo(
    () => parseLegacyDocument(passwordResetHtml),
    []
  );

  useEffect(() => {
    applyLegacyDocumentShell(legacyDocument);
    void passwordResetApp.init();
  }, [legacyDocument]);

  return <div dangerouslySetInnerHTML={{ __html: legacyDocument.bodyHtml }} />;
}
