import { useEffect } from "react";

export function RedirectRoute({ to }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return null;
}
