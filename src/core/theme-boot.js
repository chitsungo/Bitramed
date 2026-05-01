(function () {
  var storageKey = "bitramed:theme-preference";
  var query = "(prefers-color-scheme: dark)";
  var mode = "light";

  try {
    var stored = window.localStorage.getItem(storageKey);
    if (stored === "dark" || stored === "light") {
      mode = stored;
    } else if (window.matchMedia && window.matchMedia(query).matches) {
      mode = "dark";
    }
  } catch (error) {
    if (window.matchMedia && window.matchMedia(query).matches) {
      mode = "dark";
    }
  }

  document.documentElement.classList.toggle("dark-mode", mode === "dark");
  document.documentElement.style.colorScheme = mode;

  var syncBodyClass = function () {
    if (document.body) {
      document.body.classList.toggle(
        "dark-mode",
        document.documentElement.classList.contains("dark-mode")
      );
    }
  };

  syncBodyClass();
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", syncBodyClass, { once: true });
  }
}());
