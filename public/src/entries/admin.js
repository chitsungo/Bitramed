import { adminApp } from "../apps/admin-app.js";

function start() {
  adminApp.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
