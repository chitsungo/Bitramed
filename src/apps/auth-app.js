import {
  applyDocumentThemePreference,
  createSupabaseClient,
  normalizeThemePreference,
  readStoredThemePreference,
  writeStoredThemePreference,
} from "../core/supabase.js";
import {
  sendPasswordResetEmail,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from "../services/auth-service.js";
import { loadUserThemePreference } from "../services/preferences-service.js";

const PASSWORD_RESET_SUCCESS_MESSAGE =
  "Password updated. Sign in with your new password.";

export const authApp = {
  init: async function () {
    this.currentMode = "login";
    this.cacheDom();
    this.initSupabase();
    this.applyThemePreference(this.getThemePreference());
    this.setMode(this.currentMode);

    if (this.routeRecoveryLinkIfNeeded()) {
      return;
    }

    await this.redirectIfAlreadySignedIn();
    this.bindEvents();
    this.applyRouteState();
  },

  cacheDom: function () {
    this.dom = {
      authModal: document.getElementById("authModal"),
      authForm: document.getElementById("signin-form"),
      authFeedback: document.getElementById("auth-feedback"),
      modalTitle: document.getElementById("modalTitle"),
      modalSubtitle: document.getElementById("modalSubtitle"),
      nameInputGroup: document.getElementById("nameInputGroup"),
      passwordInputGroup: document.getElementById("passwordInputGroup"),
      forgotPasswordLink: document.getElementById("forgotPasswordLink"),
      emailDivider: document.getElementById("emailDivider"),
      submitBtnText: document.getElementById("submitBtnText"),
      toggleTextPrompt: document.getElementById("toggleTextPrompt"),
      toggleModeBtn: document.getElementById("toggleModeBtn"),
      submitBtn: document.getElementById("signin-submit-btn"),
      googleSigninBtnText: document.getElementById("googleSigninBtnText"),
      googleSigninBtn: document.getElementById("google-signin-btn"),
      signupName: document.getElementById("signup-display-name"),
      signinEmail: document.getElementById("signin-email"),
      signinPassword: document.getElementById("signin-password"),
      openAuthButtons: Array.from(
        document.querySelectorAll("[data-auth-open]")
      ),
      closeAuthButtons: Array.from(
        document.querySelectorAll("[data-auth-close]")
      ),
    };
  },

  initSupabase: function () {
    this.supabase = createSupabaseClient();
  },

  getOrigin() {
    return window.location.origin;
  },

  toAbsoluteUrl(path) {
    return new URL(path, this.getOrigin()).toString();
  },

  getCurrentAuthPageUrl() {
    return new URL(
      `${window.location.pathname}${window.location.search}`,
      this.getOrigin()
    ).toString();
  },

  getSafeNextPath() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") ? next : "";
  },

  buildPasswordUpdateUrl() {
    const url = new URL("/update-password/", this.getOrigin());
    const next = this.getSafeNextPath();

    if (next) {
      url.searchParams.set("next", next);
    }

    return url.toString();
  },

  getHashParams() {
    const hash = String(window.location.hash || "").replace(/^#/, "");
    return new URLSearchParams(hash);
  },

  isRecoveryLink() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = this.getHashParams();
    const type = hashParams.get("type") || searchParams.get("type");

    // Supabase always sets type=recovery in the hash for implicit-flow reset links.
    // Do NOT check for access_token/refresh_token alone — OAuth callbacks also carry
    // those tokens in the hash, which would incorrectly route Google sign-ins here.
    if (type === "recovery") {
      return true;
    }

    // token_hash is used by the OTP/email-link flow and is recovery-specific.
    return Boolean(searchParams.get("token_hash"));
  },

  routeRecoveryLinkIfNeeded() {
    if (!this.isRecoveryLink()) {
      return false;
    }

    const targetUrl = new URL("/update-password/", this.getOrigin());
    const next = this.getSafeNextPath();

    if (next) {
      targetUrl.searchParams.set("next", next);
    }

    // Carry over token_hash and type so the reset page can exchange them
    const searchParams = new URLSearchParams(window.location.search);
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");
    if (tokenHash) {
      targetUrl.searchParams.set("token_hash", tokenHash);
    }
    if (type) {
      targetUrl.searchParams.set("type", type);
    }

    if (window.location.hash) {
      targetUrl.hash = window.location.hash;
    }

    window.location.replace(targetUrl.toString());
    return true;
  },

  normalizeMode(mode) {
    if (mode === "signup" || mode === "reset-request") {
      return mode;
    }
    return "login";
  },

  clearAuthRouteState() {
    const url = new URL(window.location.href);
    const hadMode = url.searchParams.has("mode");
    const hadReset = url.searchParams.has("reset");

    if (!hadMode && !hadReset) return;

    url.searchParams.delete("mode");
    url.searchParams.delete("reset");

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", nextUrl);
  },

  applyRouteState() {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("mode");
    const resetState = params.get("reset");

    if (!requestedMode && resetState !== "success") return;

    this.openAuthModal(resetState === "success" ? "login" : requestedMode);

    if (resetState === "success") {
      this.showFeedback(PASSWORD_RESET_SUCCESS_MESSAGE, "success");
    }

    this.clearAuthRouteState();
  },

  getThemePreference() {
    if (typeof readStoredThemePreference === "function") {
      return readStoredThemePreference();
    }
    return "light";
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
      console.error("Auth theme preference load failed:", error);
      this.applyThemePreference(fallbackMode);
      return fallbackMode;
    }
  },

  async redirectIfAlreadySignedIn() {
    const { data, error } = await this.supabase.auth.getUser();

    if (error) {
      return;
    }

    if (data.user) {
      await this.loadThemePreference(data.user.id);
      window.location.replace(this.getRedirectTarget());
    }
  },

  getRedirectTarget() {
    const next = this.getSafeNextPath();
    if (next) {
      return this.toAbsoluteUrl(next);
    }
    return this.toAbsoluteUrl("/home/");
  },

  bindEvents: function () {
    this.dom.authForm?.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (this.currentMode === "signup") {
        await this.signUp();
        return;
      }

      if (this.currentMode === "reset-request") {
        await this.sendResetEmail();
        return;
      }

      await this.signIn();
    });

    this.dom.googleSigninBtn?.addEventListener("click", async () => {
      await this.signInWithGoogle();
    });

    this.dom.forgotPasswordLink?.addEventListener("click", (event) => {
      event.preventDefault();
      this.setMode("reset-request");
      window.requestAnimationFrame(() => {
        this.dom.signinEmail?.focus();
      });
    });

    this.dom.openAuthButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.openAuthModal(button.dataset.authOpen || "login");
      });
    });

    this.dom.closeAuthButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.closeAuthModal();
      });
    });

    this.dom.toggleModeBtn?.addEventListener("click", () => {
      this.toggleMode();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.dom.authModal?.hidden) {
        this.closeAuthModal();
      }
    });
  },

  rememberButtonMarkup: function (button) {
    if (!button) return;
    const labelNode =
      button === this.dom.submitBtn
        ? this.dom.submitBtnText
        : button === this.dom.googleSigninBtn
          ? this.dom.googleSigninBtnText
          : null;
    button.dataset.originalText = labelNode
      ? labelNode.textContent || ""
      : button.textContent || "";
  },

  showFeedback: function (message, type) {
    if (!this.dom.authFeedback) return;
    this.dom.authFeedback.hidden = false;
    this.dom.authFeedback.textContent = message;
    this.dom.authFeedback.className = `auth-feedback show ${type}`;
  },

  clearFeedback: function () {
    if (!this.dom.authFeedback) return;
    this.dom.authFeedback.hidden = true;
    this.dom.authFeedback.textContent = "";
    this.dom.authFeedback.className = "auth-feedback";
  },

  setButtonBusy: function (button, isBusy, busyText) {
    if (!button) return;

    if (isBusy) {
      if (!button.dataset.originalText) {
        this.rememberButtonMarkup(button);
      }
      button.disabled = true;
      if (button === this.dom.submitBtn && this.dom.submitBtnText) {
        this.dom.submitBtnText.textContent = busyText;
      } else if (
        button === this.dom.googleSigninBtn &&
        this.dom.googleSigninBtnText
      ) {
        this.dom.googleSigninBtnText.textContent = busyText;
      } else {
        button.textContent = busyText;
      }
      return;
    }

    button.disabled = false;
    if (button.dataset.originalText) {
      if (button === this.dom.submitBtn && this.dom.submitBtnText) {
        this.dom.submitBtnText.textContent = button.dataset.originalText;
      } else if (
        button === this.dom.googleSigninBtn &&
        this.dom.googleSigninBtnText
      ) {
        this.dom.googleSigninBtnText.textContent = button.dataset.originalText;
      } else {
        button.textContent = button.dataset.originalText;
      }
    }
  },

  openAuthModal: function (mode = "login") {
    if (!this.dom.authModal) return;

    this.setMode(mode);
    this.clearFeedback();
    this.dom.authModal.hidden = false;

    window.requestAnimationFrame(() => {
      if (this.currentMode === "signup") {
        this.dom.signupName?.focus();
        return;
      }
      this.dom.signinEmail?.focus();
    });
  },

  closeAuthModal: function () {
    if (!this.dom.authModal) return;

    this.clearFeedback();
    this.dom.authModal.hidden = true;
  },

  toggleMode: function () {
    if (this.currentMode === "signup" || this.currentMode === "reset-request") {
      this.setMode("login");
      return;
    }

    this.setMode("signup");
  },

  setMode: function (mode) {
    this.currentMode = this.normalizeMode(mode);

    const isSignup = this.currentMode === "signup";
    const isResetRequest = this.currentMode === "reset-request";
    const subtitle = isResetRequest
      ? "Enter the email linked to your Bitramed account and we will send you a reset link."
      : "";

    if (this.currentMode === "login") {
      this.dom.modalTitle.innerHTML =
        'Welcome <br class="hidden sm:block" /><span class="font-normal italic text-zinc-400">back, doctor.</span>';
      this.dom.submitBtnText.textContent = "Continue to Dashboard";
      this.dom.toggleTextPrompt.textContent = "Don't have an account?";
      this.dom.toggleModeBtn.textContent = "Sign up";
      this.dom.signinPassword.autocomplete = "current-password";
      this.dom.signinPassword.placeholder = "Enter your password";
    } else if (isSignup) {
      this.dom.modalTitle.innerHTML =
        'Join <br class="hidden sm:block" /><span class="font-normal italic text-zinc-400">Bitramed.</span>';
      this.dom.submitBtnText.textContent = "Create Account";
      this.dom.toggleTextPrompt.textContent = "Already have an account?";
      this.dom.toggleModeBtn.textContent = "Log in";
      this.dom.signinPassword.autocomplete = "new-password";
      this.dom.signinPassword.placeholder = "Create your password";
    } else {
      this.dom.modalTitle.innerHTML =
        'Reset <br class="hidden sm:block" /><span class="font-normal italic text-zinc-400">your password.</span>';
      this.dom.submitBtnText.textContent = "Send Reset Link";
      this.dom.toggleTextPrompt.textContent = "Remembered your password?";
      this.dom.toggleModeBtn.textContent = "Back to login";
      this.dom.signinPassword.value = "";
    }

    if (this.dom.modalSubtitle) {
      this.dom.modalSubtitle.textContent = subtitle;
      this.dom.modalSubtitle.hidden = !subtitle;
    }

    if (this.dom.nameInputGroup) {
      this.dom.nameInputGroup.hidden = !isSignup;
    }
    if (this.dom.passwordInputGroup) {
      this.dom.passwordInputGroup.hidden = isResetRequest;
    }
    if (this.dom.googleSigninBtn) {
      this.dom.googleSigninBtn.hidden = isResetRequest;
    }
    if (this.dom.emailDivider) {
      this.dom.emailDivider.hidden = isResetRequest;
    }
    if (this.dom.forgotPasswordLink) {
      this.dom.forgotPasswordLink.hidden = this.currentMode !== "login";
    }
    if (this.dom.signinPassword) {
      this.dom.signinPassword.required = !isResetRequest;
    }

    this.clearFeedback();
    this.rememberButtonMarkup(this.dom.submitBtn);
    this.rememberButtonMarkup(this.dom.googleSigninBtn);
  },

  async signIn() {
    const email = this.dom.signinEmail.value.trim();
    const password = this.dom.signinPassword.value;

    this.clearFeedback();

    if (!email || !password) {
      this.showFeedback("Enter your email and password.", "error");
      return;
    }

    this.setButtonBusy(this.dom.submitBtn, true, "Signing in...");

    try {
      const { data, error } = await signInWithPassword(this.supabase, {
        email,
        password,
      });

      if (error) {
        this.showFeedback(error.message || "Sign in failed.", "error");
        return;
      }

      await this.loadThemePreference(data?.user?.id);
      window.location.replace(this.getRedirectTarget());
    } finally {
      this.setButtonBusy(this.dom.submitBtn, false);
      this.rememberButtonMarkup(this.dom.submitBtn);
    }
  },

  async signInWithGoogle() {
    this.clearFeedback();
    this.setButtonBusy(this.dom.googleSigninBtn, true, "Connecting...");

    try {
      const redirectTo = this.getCurrentAuthPageUrl();
      const { error } = await signInWithGoogle(this.supabase, redirectTo);

      if (error) {
        this.showFeedback(error.message || "Google sign in failed.", "error");
      }
    } catch (error) {
      this.showFeedback(error?.message || "Google sign in failed.", "error");
    } finally {
      this.setButtonBusy(this.dom.googleSigninBtn, false);
      this.rememberButtonMarkup(this.dom.googleSigninBtn);
    }
  },

  async signUp() {
    const displayName = this.dom.signupName.value.trim();
    const email = this.dom.signinEmail.value.trim();
    const password = this.dom.signinPassword.value;

    this.clearFeedback();

    if (!displayName || !email || !password) {
      this.showFeedback("Enter display name, email, and password.", "error");
      return;
    }

    if (displayName.length < 2) {
      this.showFeedback(
        "Use a display name with at least 2 characters.",
        "error"
      );
      return;
    }

    if (password.length < 6) {
      this.showFeedback("Use a password with at least 6 characters.", "error");
      return;
    }

    this.setButtonBusy(this.dom.submitBtn, true, "Creating account...");

    try {
      const { data, error } = await signUpWithPassword(this.supabase, {
        displayName,
        email,
        password,
      });

      if (error) {
        this.showFeedback(error.message || "Account creation failed.", "error");
        return;
      }

      if (data.session) {
        await this.loadThemePreference(data.user?.id);
        window.location.replace(this.getRedirectTarget());
        return;
      }

      this.showFeedback(
        "Account created. Check your email to confirm, then sign in.",
        "success"
      );
    } finally {
      this.setButtonBusy(this.dom.submitBtn, false);
      this.rememberButtonMarkup(this.dom.submitBtn);
    }
  },

  async sendResetEmail() {
    const email = this.dom.signinEmail.value.trim();

    this.clearFeedback();

    if (!email) {
      this.showFeedback("Enter your email address.", "error");
      return;
    }

    this.setButtonBusy(this.dom.submitBtn, true, "Sending link...");

    try {
      const { error } = await sendPasswordResetEmail(this.supabase, {
        email,
        redirectTo: this.buildPasswordUpdateUrl(),
      });

      if (error) {
        this.showFeedback(
          error.message || "Could not send the password reset email.",
          "error"
        );
        return;
      }

      this.showFeedback(
        "If an account exists for that email, we've sent a password reset link.",
        "success"
      );
    } finally {
      this.setButtonBusy(this.dom.submitBtn, false);
      this.rememberButtonMarkup(this.dom.submitBtn);
    }
  },
};
