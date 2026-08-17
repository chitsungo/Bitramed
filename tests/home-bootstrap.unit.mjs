import assert from "node:assert/strict";
import test from "node:test";

const createClassList = () => ({
  add() {},
  contains() {
    return false;
  },
  remove() {},
  toggle() {},
});

globalThis.window = {
  clearTimeout,
  localStorage: {
    getItem() {
      return null;
    },
    removeItem() {},
    setItem() {},
  },
  location: {
    pathname: "/home/",
    replace(value) {
      this.redirectedTo = value;
    },
    search: "",
  },
  matchMedia() {
    return { addEventListener() {}, matches: false };
  },
  sessionStorage: {
    getItem() {
      return null;
    },
    removeItem() {},
    setItem() {},
  },
  setTimeout,
};

globalThis.document = {
  addEventListener() {},
  body: { classList: createClassList(), dataset: {} },
  documentElement: { classList: createClassList(), style: {} },
};

const [{ learnerCore }, { learnerFeatures }, { authApp }, { pastPaperApp }] =
  await Promise.all([
    import("../public/src/apps/learner-core.js"),
    import("../public/src/apps/learner-features.js"),
    import("../public/src/apps/auth-app.js"),
    import("../public/src/features/past-papers/past-paper-app.js"),
  ]);

function createBootstrapPayload() {
  return {
    access: { hasAccess: true, status: "active" },
    dashboard: {
      activeYears: 1,
      averageScore: 75,
      completedCount: 3,
      levels: [
        {
          courseCount: 2,
          displayOrder: 1,
          doneCount: 3,
          levelId: "level-1",
          name: "Year 1",
          percent: 60,
          totalCount: 5,
        },
      ],
      pastPaperYears: [{ exam_count: 1, year_label: "Year 1" }],
    },
    generatedAt: "2026-08-11T00:00:00Z",
    schemaVersion: 1,
    themePreference: "dark",
  };
}

test("home bootstrap normalizes once and deduplicates concurrent callers", async () => {
  let releaseResponse;
  let rpcCalls = 0;
  const response = new Promise((resolve) => {
    releaseResponse = resolve;
  });
  const app = {
    ...learnerCore,
    ...learnerFeatures,
    ...pastPaperApp,
    getSupabase() {
      return {
        rpc(name) {
          assert.equal(name, "app_home_bootstrap");
          rpcCalls += 1;
          return response;
        },
      };
    },
    scheduleAppDataCacheWrite() {},
    state: JSON.parse(JSON.stringify(learnerCore.state)),
    withTimeout(promise) {
      return promise;
    },
  };

  const first = app.loadHomeBootstrap();
  const second = app.loadHomeBootstrap();
  releaseResponse({ data: createBootstrapPayload(), error: null });

  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(rpcCalls, 1);
  assert.equal(app.state.levelList[0].name, "Year 1");
  assert.equal(
    app.state.homeDashboard.levelProgressByName["Year 1"].totalCount,
    5
  );
  assert.equal(app.state.pastPapers.years[0].yearLabel, "Year 1");
});

test("successful homepage bootstrap skips every legacy homepage read", async () => {
  let legacyCalls = 0;
  const legacyRead = async () => {
    legacyCalls += 1;
  };
  const app = {
    ...learnerCore,
    loadAccessStatus: legacyRead,
    loadAreaCatalog: legacyRead,
    loadHomeBootstrap: async () => true,
    loadPastPaperYears: legacyRead,
    loadPersonalizationData: legacyRead,
    loadThemePreference: legacyRead,
    preloadQuizCatalog: legacyRead,
    showLoadingView() {},
    state: {
      ...JSON.parse(JSON.stringify(learnerCore.state)),
      accessStatus: { hasAccess: true },
    },
  };

  assert.equal(
    await app.loadDatabase({ routeOnComplete: false, showLoading: false }),
    true
  );
  assert.equal(legacyCalls, 0);
});

test("legacy fallback is limited to a genuinely missing bootstrap RPC", () => {
  assert.equal(
    learnerFeatures.isHomeBootstrapUnavailable({
      code: "PGRST202",
      message: "Could not find the function app_home_bootstrap",
    }),
    true
  );
  assert.equal(
    learnerFeatures.isHomeBootstrapUnavailable({
      code: "57014",
      message: "Loading homepage timed out",
    }),
    false
  );
  assert.equal(
    learnerFeatures.isHomeBootstrapUnavailable({
      code: "42501",
      message: "permission denied",
    }),
    false
  );
});

test("signed-in auth redirect uses local session without getUser", async () => {
  let getSessionCalls = 0;
  let getUserCalls = 0;
  const originalSupabase = authApp.supabase;
  const originalRedirectTarget = authApp.getRedirectTarget;

  authApp.supabase = {
    auth: {
      getSession() {
        getSessionCalls += 1;
        return Promise.resolve({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        });
      },
      getUser() {
        getUserCalls += 1;
        throw new Error("getUser must not run on startup");
      },
    },
  };
  authApp.getRedirectTarget = () => "https://example.test/home/";

  try {
    assert.equal(await authApp.redirectIfAlreadySignedIn(), true);
    assert.equal(getSessionCalls, 1);
    assert.equal(getUserCalls, 0);
    assert.equal(window.location.redirectedTo, "https://example.test/home/");
  } finally {
    authApp.supabase = originalSupabase;
    authApp.getRedirectTarget = originalRedirectTarget;
  }
});
