import {
  applyDocumentThemePreference,
  createSupabaseClient,
  normalizeThemePreference,
  readStoredThemePreference,
  writeStoredThemePreference,
} from "../core/supabase.js";
import { updatePassword } from "../services/auth-service.js";
import { loadUserThemePreference } from "../services/preferences-service.js";

export const passwordResetApp = {
  init: async function () {
    this.recoveryReady = false;
    this.recoveryTimeoutId = 0;
    this.cacheDom();
    this.initSupabase();
    this.applyThemePreference(this.getThemePreference());
    this.bindEvents();
    await this.resolveRecoveryState();
  },

  cacheDom() {
    this.dom = {
      pageTitle: document.getElementById("resetPageTitle"),
      pageCopy: document.getElementById("resetPageCopy"),
      loadingState: document.getElementById("resetLoadingState"),
      form: document.getElementById("passwordResetForm"),
      feedback: document.getElementById("password-reset-feedback"),
      invalidState: document.getElementById("resetInvalidState"),
      passwordInput: document.getElementById("reset-password"),
      confirmInput: document.getElementById("reset-password-confirm"),
      submitBtn: document.getElementById("passwordResetSubmit"),
      submitBtnText: document.getElementById("passwordResetSubmitText"),
    };
  },

  initSupabase() {
    this.supabase = createSupabaseClient();
  },

  getThemePreference() {
    return typeof readStoredThemePreference === "function"
      ? readStoredThemePreference()
      : "light";
  },

  applyThemePreference(mode) {
    return typeof applyDocumentThemePreference === "function"
      ? applyDocumentThemePreference(mode)
      : mode === "dark"
        ? "dark"
        : "light";
  },

  async loadThemePreference(userId) {
    const fallbackMode = this.getThemePreference();
    this.applyThemePreference(fallbackMode);

    if (!userId) return fallbackMode;

    try {
      const theme = await loadUserThemePreference(this.supabase, userId);
      const resolvedMode =
        typeof normalizeThemePreference === "function"
          ? normalizeThemePreference(theme)
          : theme === "dark"
            ? "dark"
            : "light";

      if (typeof writeStoredThemePreference === "function") {
        writeStoredThemePreference(resolvedMode);
      }
      this.applyThemePreference(resolvedMode);
      return resolvedMode;
    } catch (error) {
      console.error("Password reset theme load failed:", error);
      this.applyThemePreference(fallbackMode);
      return fallbackMode;
    }
  },

  bindEvents() {
    this.dom.form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.submitNewPassword();
    });
  },

  rememberButtonMarkup(button) {
    if (!button) return;
    button.dataset.originalText = button.innerHTML;
  },

  setButtonBusy(button, isBusy, busyText) {
    if (!button) return;

    if (isBusy) {
      if (!button.dataset.originalText) {
        this.rememberButtonMarkup(button);
      }
      button.disabled = true;
      button.textContent = busyText;
      return;
    }

    button.disabled = false;
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
    }
  },

  showFeedback(message, type) {
    if (!this.dom.feedback) return;
    this.dom.feedback.hidden = false;
    this.dom.feedback.textContent = message;
    this.dom.feedback.className = `auth-feedback show ${type}`;
  },

  clearFeedback() {
    if (!this.dom.feedback) return;
    this.dom.feedback.hidden = true;
    this.dom.feedback.textContent = "";
    this.dom.feedback.className = "auth-feedback";
  },

  getSafeNextPath() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") ? next : "";
  },

  getLoginRedirectUrl() {
    const url = new URL("/", window.location.origin);
    url.searchParams.set("mode", "login");
    url.searchParams.set("reset", "success");

    const next = this.getSafeNextPath();
    if (next) {
      url.searchParams.set("next", next);
    }

    return url.toString();
  },

  async getExistingSession() {
    if (typeof this.supabase.auth.getSession === "function") {
      const { data, error } = await this.supabase.auth.getSession();
      if (!error && data?.session) {
        return data.session;
      }
    }

    if (typeof this.supabase.auth.getUser === "function") {
      const { data, error } = await this.supabase.auth.getUser();
      if (!error && data?.user) {
        return { user: data.user };
      }
    }

    return null;
  },

  async unlockReset(session) {
    if (this.recoveryTimeoutId) {
      window.clearTimeout(this.recoveryTimeoutId);
      this.recoveryTimeoutId = 0;
    }

    this.recoveryReady = true;
    this.clearFeedback();
    await this.loadThemePreference(session?.user?.id);

    if (this.dom.pageTitle) {
      this.dom.pageTitle.innerHTML =
        'Set your <span class="font-normal italic text-zinc-400">new password.</span>';
    }
    if (this.dom.pageCopy) {
      this.dom.pageCopy.textContent =
        "Choose a new password for your Bitramed account to continue.";
    }
    if (this.dom.loadingState) {
      this.dom.loadingState.hidden = true;
    }
    if (this.dom.invalidState) {
      this.dom.invalidState.hidden = true;
    }
    if (this.dom.form) {
      this.dom.form.hidden = false;
    }

    window.requestAnimationFrame(() => {
      this.dom.passwordInput?.focus();
    });
  },

  showInvalidState() {
    this.recoveryReady = false;
    this.clearFeedback();

    if (this.dom.pageTitle) {
      this.dom.pageTitle.innerHTML =
        'Reset link <span class="font-normal italic text-zinc-400">expired.</span>';
    }
    if (this.dom.pageCopy) {
      this.dom.pageCopy.textContent =
        "This recovery link is no longer valid. Request a new password reset email and try again.";
    }
    if (this.dom.loadingState) {
      this.dom.loadingState.hidden = true;
    }
    if (this.dom.form) {
      this.dom.form.hidden = true;
    }
    if (this.dom.invalidState) {
      this.dom.invalidState.hidden = false;
    }
  },

  async resolveRecoveryState() {
    try {
      if (typeof this.supabase.auth.onAuthStateChange === "function") {
        const { data } = this.supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (
              event === "PASSWORD_RECOVERY" ||
              (session?.user && event === "SIGNED_IN")
            ) {
              await this.unlockReset(session);
            }
          }
        );
        this.authSubscription = data?.subscription || null;
      }

      // Supabase does not auto-exchange token_hash — must call verifyOtp explicitly
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      if (tokenHash && type === "recovery") {
        const { error } = await this.supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (error) {
          this.showInvalidState();
        }
        // onAuthStateChange PASSWORD_RECOVERY fires on success
        return;
      }

      const session = await this.getExistingSession();
      if (session?.user) {
        await this.unlockReset(session);
        return;
      }

      this.recoveryTimeoutId = window.setTimeout(() => {
        if (!this.recoveryReady) {
          this.showInvalidState();
        }
      }, 3000);
    } catch (error) {
      console.error("Password reset recovery validation failed:", error);
      this.showInvalidState();
    }
  },

  async submitNewPassword() {
    const password = String(this.dom.passwordInput?.value || "");
    const confirmation = String(this.dom.confirmInput?.value || "");

    this.clearFeedback();

    if (!this.recoveryReady) {
      this.showInvalidState();
      return;
    }

    if (!password || !confirmation) {
      this.showFeedback("Enter and confirm your new password.", "error");
      return;
    }

    if (password.length < 6) {
      this.showFeedback("Use a password with at least 6 characters.", "error");
      return;
    }

    if (password !== confirmation) {
      this.showFeedback("Passwords do not match.", "error");
      return;
    }

    this.setButtonBusy(this.dom.submitBtn, true, "Updating password...");

    try {
      const { error } = await updatePassword(this.supabase, { password });

      if (error) {
        this.showFeedback(error.message || "Password update failed.", "error");
        return;
      }

      this.showFeedback(
        "Password updated. Returning you to sign in.",
        "success"
      );

      if (typeof this.supabase.auth.signOut === "function") {
        await this.supabase.auth.signOut();
      }

      window.location.replace(this.getLoginRedirectUrl());
    } finally {
      this.setButtonBusy(this.dom.submitBtn, false);
      this.rememberButtonMarkup(this.dom.submitBtn);
    }
  },
};
