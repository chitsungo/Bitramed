function toNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function sortByAverageDescending(a, b) {
  return toNumber(b.average_percentage) - toNumber(a.average_percentage);
}

function sortUsersByAttempts(a, b) {
  return toNumber(b.total_attempts) - toNumber(a.total_attempts);
}

function sortUsersByAverage(a, b) {
  return toNumber(b.average_percentage) - toNumber(a.average_percentage);
}

function sortUsersByAttention(a, b) {
  const averageDiff = toNumber(a.average_percentage) - toNumber(b.average_percentage);
  if (averageDiff !== 0) return averageDiff;
  return toNumber(b.total_attempts) - toNumber(a.total_attempts);
}

function collectIdentityTokens(record = {}) {
  const values = [
    record?.user_id,
    record?.userId,
    record?.id,
    record?.account_id,
    record?.accountId,
    record?.email
  ];

  return [...new Set(
    values
      .map((value) => String(value ?? "").trim().toLowerCase())
      .filter(Boolean)
  )];
}

function collectRoleTokens(value) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectRoleTokens(entry));
  }

  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return [];

  return text
    .split(/[\s,|/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function stringIndicatesPrivilege(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return false;

  return ["admin", "owner", "staff", "superuser"].some((token) => text.includes(token));
}

function recordIndicatesPrivilegeByText(record = {}) {
  const textFields = [
    record?.email,
    record?.display_name,
    record?.displayName,
    record?.name,
    record?.full_name,
    record?.fullName,
    record?.notes,
    record?.tag,
    record?.tags,
    record?.kind,
    record?.type,
    record?.account_type,
    record?.accountType
  ];

  if (textFields.some((value) => stringIndicatesPrivilege(value))) {
    return true;
  }

  const metadataFields = [
    record?.metadata,
    record?.user_metadata,
    record?.userMetadata,
    record?.app_metadata,
    record?.appMetadata,
    record?.claims
  ];

  return metadataFields.some((value) => {
    if (!value || typeof value !== "object") return false;
    return Object.values(value).some((entry) => stringIndicatesPrivilege(entry));
  });
}

function hasPrivilegeFlag(record = {}) {
  if (
    record?.is_admin === true ||
    record?.isAdmin === true ||
    record?.is_owner === true ||
    record?.isOwner === true
  ) {
    return true;
  }

  const roleFields = [
    record?.role,
    record?.roles,
    record?.account_role,
    record?.accountRole,
    record?.user_role,
    record?.userRole,
    record?.app_role,
    record?.appRole,
    record?.access_role,
    record?.accessRole
  ];

  const hasRoleToken = roleFields.some((field) => {
    const tokens = collectRoleTokens(field);
    return tokens.includes("admin") ||
      tokens.includes("owner") ||
      tokens.includes("staff") ||
      tokens.includes("superuser");
  });

  if (hasRoleToken) return true;

  return recordIndicatesPrivilegeByText(record);
}

function matchesIdentitySet(record, identitySet) {
  if (!identitySet?.size) return false;
  return collectIdentityTokens(record).some((token) => identitySet.has(token));
}

function sumField(rows, field) {
  return (rows || []).reduce((sum, row) => sum + toNumber(row?.[field]), 0);
}

function computeWeightedAverage(rows, valueField, weightField) {
  const totalWeight = sumField(rows, weightField);
  if (totalWeight > 0) {
    const weightedTotal = (rows || []).reduce(
      (sum, row) => sum + (toNumber(row?.[valueField]) * toNumber(row?.[weightField])),
      0
    );
    return Math.round(weightedTotal / totalWeight);
  }

  const values = (rows || [])
    .map((row) => toNumber(row?.[valueField]))
    .filter((value) => value > 0);

  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildCourseAnalyticsFromAttempts(attempts = []) {
  const courseMap = new Map();

  (attempts || []).forEach((attempt) => {
    const area = toText(attempt?.area, "");
    if (!area) return;

    if (!courseMap.has(area)) {
      courseMap.set(area, {
        area,
        totalAttempts: 0,
        percentageTotal: 0,
        uniqueUsers: new Set(),
        bestUserAverage: 0
      });
    }

    const entry = courseMap.get(area);
    entry.totalAttempts += 1;
    entry.percentageTotal += toNumber(attempt?.percentage);
    collectIdentityTokens(attempt).forEach((token) => entry.uniqueUsers.add(token));
    entry.bestUserAverage = Math.max(entry.bestUserAverage, toNumber(attempt?.percentage));
  });

  return [...courseMap.values()]
    .map((entry) => ({
      area: entry.area,
      total_attempts: entry.totalAttempts,
      unique_users: entry.uniqueUsers.size,
      average_percentage: entry.totalAttempts
        ? Math.round(entry.percentageTotal / entry.totalAttempts)
        : 0,
      best_user_average: entry.bestUserAverage
    }))
    .sort(sortByAverageDescending);
}

function buildStatsScope({
  accessRows = [],
  users = [],
  recent = [],
  currentUser = null
} = {}) {
  const privilegedIdentitySet = new Set(collectIdentityTokens(currentUser));

  [...(accessRows || []), ...(users || []), ...(recent || [])].forEach((record) => {
    if (!hasPrivilegeFlag(record)) return;
    collectIdentityTokens(record).forEach((token) => privilegedIdentitySet.add(token));
  });

  const scopedAccessRows = (accessRows || []).filter((row) => (
    !hasPrivilegeFlag(row) &&
    !matchesIdentitySet(row, privilegedIdentitySet)
  ));

  const eligibleAccessRows = scopedAccessRows.filter((row) => (
    String(row?.status || "no_access") === "active" &&
    !hasPrivilegeFlag(row)
  ));

  const eligibleIdentitySet = new Set();
  eligibleAccessRows.forEach((row) => {
    collectIdentityTokens(row).forEach((token) => eligibleIdentitySet.add(token));
  });

  const isEligibleRecord = (record) => (
    !hasPrivilegeFlag(record) &&
    !matchesIdentitySet(record, privilegedIdentitySet) &&
    matchesIdentitySet(record, eligibleIdentitySet)
  );

  return {
    accessRows: scopedAccessRows,
    activeAccessRows: eligibleAccessRows,
    users: (users || []).filter(isEligibleRecord),
    recent: (recent || []).filter(isEligibleRecord)
  };
}

export function buildAccessSummary(accessRows = []) {
  const counts = {
    active: 0,
    expired: 0,
    blocked: 0,
    noAccess: 0,
    totalTracked: accessRows.length || 0
  };

  accessRows.forEach((row) => {
    const status = String(row?.status || "no_access");
    if (status === "active") counts.active += 1;
    else if (status === "expired") counts.expired += 1;
    else if (status === "blocked") counts.blocked += 1;
    else counts.noAccess += 1;
  });

  counts.activeRate = counts.totalTracked
    ? Math.round((counts.active / counts.totalTracked) * 100)
    : 0;
  counts.backlog = counts.expired + counts.noAccess;
  return counts;
}

export function getAccessBuckets(accessRows = []) {
  const summary = buildAccessSummary(accessRows);

  return [
    {
      key: "active",
      title: "Active",
      subtitle: "Currently allowed into Bitramed",
      orb: "A",
      tone: "tone-access",
      countLabel: String(summary.active)
    },
    {
      key: "expired",
      title: "Expired",
      subtitle: "Access ended and waiting for renewal",
      orb: "E",
      tone: "tone-analytics",
      countLabel: String(summary.expired)
    },
    {
      key: "no_access",
      title: "New",
      subtitle: "Signed in but not yet activated",
      orb: "N",
      tone: "tone-neutral",
      countLabel: String(summary.noAccess)
    },
    {
      key: "blocked",
      title: "Blocked",
      subtitle: "Restricted by owner action",
      orb: "X",
      tone: "tone-danger",
      countLabel: String(summary.blocked)
    }
  ];
}

export function getAccessCategoryMeta(category) {
  return {
    active: {
      title: "Active Users",
      subtitle: "Accounts currently able to use Bitramed."
    },
    expired: {
      title: "Expired Users",
      subtitle: "Accounts that need renewal before they can access Bitramed."
    },
    no_access: {
      title: "New Users",
      subtitle: "Accounts that exist but have not yet been activated."
    },
    blocked: {
      title: "Blocked Users",
      subtitle: "Accounts intentionally restricted by admin action."
    }
  }[category] || {
    title: "Access Control",
    subtitle: "Grant 30-day access, renew subscriptions, and block or restore accounts."
  };
}

function buildSignal(label, title, note, value = "", tone = "accent") {
  return { label, title, note, value, tone };
}

export function buildAdminStatsViewModel({
  overview = {},
  courses = [],
  users = [],
  recent = [],
  accessRows = [],
  currentUser = null
} = {}) {
  const statsScope = buildStatsScope({
    accessRows,
    users,
    recent,
    currentUser
  });
  const statsUsers = statsScope.users;
  const statsRecent = statsScope.recent;
  const statsActiveAccessRows = statsScope.activeAccessRows;
  const scopedCourses = buildCourseAnalyticsFromAttempts(statsRecent);

  const sortedCourses = [...scopedCourses].sort(sortByAverageDescending);
  const sortedUsersByAttempts = [...statsUsers].sort(sortUsersByAttempts);
  const sortedUsersByAverage = [...statsUsers].sort(sortUsersByAverage);
  const watchlist = [...statsUsers]
    .filter((user) => toNumber(user.total_attempts) > 0)
    .sort(sortUsersByAttention);

  const strongestCourse = sortedCourses[0] || null;
  const weakestCourse = sortedCourses.length ? sortedCourses[sortedCourses.length - 1] : null;
  const mostActiveUser = sortedUsersByAttempts[0] || null;
  const highestUser = sortedUsersByAverage[0] || null;
  const needsAttentionUser = watchlist[0] || null;
  const accessSummary = buildAccessSummary(accessRows);

  const totalUsers = statsActiveAccessRows.length;
  const engagedUsers = statsUsers.filter((user) => toNumber(user.total_attempts) > 0).length;
  const totalAttempts = sumField(statsUsers, "total_attempts");
  const totalQuizzesDone = sumField(statsUsers, "quizzes_done");
  const averagePercentage = computeWeightedAverage(statsUsers, "average_percentage", "total_attempts");
  const engagementRate = totalUsers ? Math.round((engagedUsers / totalUsers) * 100) : 0;
  const inactiveUsers = Math.max(totalUsers - engagedUsers, 0);
  const attemptsPerLearner = engagedUsers ? Math.round(totalAttempts / engagedUsers) : 0;
  const courseSpread = strongestCourse && weakestCourse
    ? Math.max(0, toNumber(strongestCourse.average_percentage) - toNumber(weakestCourse.average_percentage))
    : 0;

  const strongestCourseName = toText(strongestCourse?.area, "No leader");
  const weakestCourseName = toText(weakestCourse?.area, "No risk");
  const topLearnerName = toText(highestUser?.display_name || highestUser?.email, "No learner");
  const attentionLearnerName = toText(
    needsAttentionUser?.display_name || needsAttentionUser?.email,
    "No learner"
  );

  const executiveStoryTitle = highestUser
    ? `${topLearnerName} is setting the pace inside the active learner pool.`
    : strongestCourse
      ? `${strongestCourseName} has the clearest recent signal among active learners.`
      : totalUsers
        ? "Active learner data is flowing, but there is not enough depth yet for a clear leader."
        : "The platform is live, but there is not enough active learner data yet to surface a lead story.";

  const executiveStoryBody = totalUsers
    ? `${engagedUsers} of ${totalUsers} active learner accounts have recorded activity, with ${averagePercentage}% average performance across ${totalAttempts} saved attempts. ${inactiveUsers ? `The remaining ${inactiveUsers} active accounts have not logged a first attempt yet.` : "Every active learner has some recorded activity."} ${mostActiveUser ? `${toText(mostActiveUser.display_name || mostActiveUser.email, "A learner")} currently leads activity volume with ${toNumber(mostActiveUser.total_attempts)} attempts.` : ""}`
    : "No active learner activity has been recorded yet.";

  return {
    menuLead: highestUser
      ? `${topLearnerName} leads the active learner pool at ${toNumber(highestUser.average_percentage)}% average.`
      : totalUsers
        ? "A quieter control room for active learner performance and access operations."
        : "No active learner performance is available yet.",
    menuSummary: {
      activeUsers: totalUsers,
      totalAttempts,
      averagePercentage
    },
    statsSummary: {
      totalUsers,
      totalQuizzesDone,
      averagePercentage,
      engagementRate
    },
    executiveBrief: {
      title: executiveStoryTitle,
      body: executiveStoryBody,
      chips: [
        `${totalUsers} active accounts`,
        `${engagedUsers}/${totalUsers || 0} engaged`,
        strongestCourse && totalUsers ? `Leader ${strongestCourseName}` : "",
        highestUser ? `Top learner ${topLearnerName}` : ""
      ].filter(Boolean)
    },
    accessSummary,
    accessBuckets: getAccessBuckets(accessRows),
    pulseCards: [
      {
        label: "Engagement",
        value: `${engagementRate}%`,
        note: `${engagedUsers} engaged and ${inactiveUsers} active without history`,
        tone: engagementRate >= 75 ? "green" : engagementRate >= 50 ? "blue" : "amber"
      },
      {
        label: "Attempts Per Learner",
        value: String(attemptsPerLearner),
        note: `${totalAttempts} saved attempts across ${Math.max(engagedUsers, 1)} engaged active learners`,
        tone: totalAttempts ? "blue" : "accent"
      },
      {
        label: "Active Roster",
        value: String(totalUsers),
        note: `${engagedUsers} active learners with saved history`,
        tone: totalUsers ? "accent" : "amber"
      },
      {
        label: "Course Spread",
        value: `${courseSpread} pts`,
        note: strongestCourse && weakestCourse
          ? `${strongestCourseName} leads ${weakestCourseName}`
          : "Not enough active-attempt course data to compare leaders and laggards",
        tone: strongestCourse && weakestCourse
          ? courseSpread >= 15
            ? "amber"
            : "green"
          : "accent"
      }
    ],
    operatingRows: [
      {
        label: "Engagement",
        value: engagementRate,
        displayValue: `${engagementRate}%`,
        note: "Active users with quiz history"
      },
      {
        label: "Average Score",
        value: averagePercentage,
        displayValue: `${averagePercentage}%`,
        note: "Attempt-weighted average across active learners"
      },
      {
        label: "Active Learners",
        value: totalUsers,
        displayValue: String(totalUsers),
        note: "Accounts with active access in scope"
      },
      {
        label: "Attempts per Learner",
        value: attemptsPerLearner,
        displayValue: String(attemptsPerLearner),
        note: "Average activity per engaged active learner"
      }
    ],
    signals: [
      buildSignal(
        "Roster",
        inactiveUsers
          ? "First attempts are still pending"
          : "All active learners have activity",
        inactiveUsers
          ? `${inactiveUsers} active accounts still have no saved quiz history.`
          : "Every active learner currently contributes to the performance signal.",
        inactiveUsers ? String(inactiveUsers) : "Live",
        inactiveUsers ? "amber" : "green"
      ),
      buildSignal(
        "Course Risk",
        weakestCourse
          ? `${weakestCourseName} is trailing`
          : "No course risk is visible yet",
        weakestCourse
          ? `${toNumber(weakestCourse.average_percentage)}% average with a ${courseSpread}-point gap to ${strongestCourseName}.`
          : "Active learner course-level performance has not been recorded yet.",
        weakestCourse ? `${toNumber(weakestCourse.average_percentage)}%` : "",
        weakestCourse
          ? courseSpread >= 15
            ? "amber"
            : "blue"
          : "accent"
      ),
      buildSignal(
        "Learner Risk",
        needsAttentionUser
          ? `${attentionLearnerName} needs a check-in`
          : "No learner needs urgent intervention",
        needsAttentionUser
          ? `${toNumber(needsAttentionUser.average_percentage)}% average over ${toNumber(needsAttentionUser.total_attempts)} attempts. Strongest area: ${toText(needsAttentionUser.strongest_area, "No data")}.`
          : "Current active learner performance does not show a clear intervention target.",
        needsAttentionUser ? `${toNumber(needsAttentionUser.average_percentage)}%` : "",
        needsAttentionUser
          ? toNumber(needsAttentionUser.average_percentage) < 55
            ? "danger"
            : "amber"
          : "green"
      )
    ],
    courseComparison: sortedCourses.slice(0, 6).map((course) => ({
      label: toText(course.area, "Unknown course"),
      value: toNumber(course.average_percentage),
      displayValue: `${toNumber(course.average_percentage)}%`,
      note: `${toNumber(course.unique_users)} learners - ${toNumber(course.total_attempts)} recent attempts`
    })),
    courseDiagnostics: sortedCourses.map((course, index) => ({
      rank: index + 1,
      area: toText(course.area, "Unknown course"),
      averagePercentage: toNumber(course.average_percentage),
      totalAttempts: toNumber(course.total_attempts),
      uniqueUsers: toNumber(course.unique_users),
      bestUserAverage: toNumber(course.best_user_average),
      standing: index === 0 ? "Leading course" : index === sortedCourses.length - 1 ? "Needs review" : "Mid-range performer"
    })),
    learnerWatchlist: watchlist.slice(0, 8).map((user, index) => ({
      priority: index + 1,
      displayName: toText(user.display_name || user.email, "User"),
      email: toText(user.email, "No email"),
      averagePercentage: toNumber(user.average_percentage),
      totalAttempts: toNumber(user.total_attempts),
      quizzesDone: toNumber(user.quizzes_done),
      bestPercentage: toNumber(user.best_percentage),
      strongestArea: toText(user.strongest_area, "No data"),
      weakestArea: toText(user.weakest_area, "No data"),
      latestActivity: user.latest_activity || "",
      attentionLabel: toNumber(user.average_percentage) < 55
        ? "Needs attention"
        : toNumber(user.average_percentage) < 70
          ? "Watch"
          : "Stable"
    })),
    recentActivity: statsRecent.slice(0, 15).map((attempt) => ({
      quizTitle: toText(attempt.quiz_title, "Quiz"),
      displayName: toText(attempt.display_name || attempt.email, "User"),
      area: toText(attempt.area, "Unknown course"),
      mode: toText(attempt.mode, "study"),
      percentage: toNumber(attempt.percentage),
      score: toNumber(attempt.score),
      totalQuestions: toNumber(attempt.total_questions),
      completedAt: attempt.completed_at || ""
    })),
    topRankedUsers: sortedUsersByAverage
      .filter((user) => toNumber(user.total_attempts) > 0)
      .slice(0, 10)
      .map((user, index) => ({
        rank: index + 1,
        displayName: toText(user.display_name || user.email, "User"),
        email: toText(user.email, "No email"),
        averagePercentage: toNumber(user.average_percentage),
        totalAttempts: toNumber(user.total_attempts),
        quizzesDone: toNumber(user.quizzes_done),
        bestPercentage: toNumber(user.best_percentage),
        strongestArea: toText(user.strongest_area, "No data"),
      })),
    mostActiveUser: mostActiveUser
      ? {
          displayName: toText(mostActiveUser.display_name || mostActiveUser.email, "User"),
          totalAttempts: toNumber(mostActiveUser.total_attempts)
        }
      : null
  };
}
