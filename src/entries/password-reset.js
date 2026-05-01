import { passwordResetApp } from "../apps/password-reset-app.js";

function start() {
  passwordResetApp.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
