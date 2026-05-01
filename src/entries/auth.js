import { authApp } from "../apps/auth-app.js";

function start() {
  authApp.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
