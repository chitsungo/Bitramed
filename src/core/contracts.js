/**
 * @typedef {Object} AccessStatus
 * @property {string} status
 * @property {boolean} hasAccess
 * @property {string | null} blockReason
 * @property {string | null} accessExpiresAt
 */

/**
 * @typedef {Object} QuizQuestion
 * @property {string} key
 * @property {string} q
 * @property {string} a
 * @property {string} exp
 * @property {string} img
 * @property {string[] | null} options
 * @property {string} type
 */

/**
 * @typedef {Object} AttemptRecord
 * @property {number | string} id
 * @property {string} userId
 * @property {string} quizId
 * @property {string} mode
 * @property {number} score
 * @property {number} totalQuestions
 * @property {number} correctCount
 * @property {number} wrongCount
 * @property {number} unansweredCount
 * @property {number} percentage
 * @property {string} completedAt
 */

/**
 * @typedef {Object} AdminOverview
 * @property {number} total_users
 * @property {number} active_users
 * @property {number} total_attempts
 * @property {number} total_quizzes_done
 * @property {number} average_percentage
 */

/**
 * @typedef {Object} AdminAccessRow
 * @property {string} user_id
 * @property {string} email
 * @property {string} display_name
 * @property {string} status
 * @property {string | null} access_expires_at
 * @property {string | null} blocked_at
 * @property {string | null} block_reason
 * @property {string | null} notes
 */

/**
 * @typedef {Object} AdminKpiCard
 * @property {string} label
 * @property {string} value
 * @property {string} note
 */

/**
 * @typedef {Object} AdminSignal
 * @property {string} label
 * @property {string} title
 * @property {string} note
 * @property {string} [value]
 */

/**
 * @typedef {Object} CourseDiagnostic
 * @property {number} rank
 * @property {string} area
 * @property {number} averagePercentage
 * @property {number} totalAttempts
 * @property {number} uniqueUsers
 * @property {number} bestUserAverage
 * @property {string} standing
 */

/**
 * @typedef {Object} LearnerWatchItem
 * @property {number} priority
 * @property {string} displayName
 * @property {string} email
 * @property {number} averagePercentage
 * @property {number} totalAttempts
 * @property {number} quizzesDone
 * @property {number} bestPercentage
 * @property {string} strongestArea
 * @property {string} weakestArea
 * @property {string} latestActivity
 * @property {string} attentionLabel
 */

/**
 * @typedef {Object} RecentActivityItem
 * @property {string} quizTitle
 * @property {string} displayName
 * @property {string} area
 * @property {string} mode
 * @property {number} percentage
 * @property {number} score
 * @property {number} totalQuestions
 * @property {string} completedAt
 */

/**
 * @typedef {Object} AdminStatsViewModel
 * @property {string} menuLead
 * @property {{ activeUsers: number, totalAttempts: number, averagePercentage: number }} menuSummary
 * @property {{ totalUsers: number, totalQuizzesDone: number, averagePercentage: number, engagementRate: number }} statsSummary
 * @property {{ active: number, expired: number, blocked: number, noAccess: number, totalTracked: number, activeRate: number, backlog: number }} accessSummary
 * @property {Array<AdminKpiCard>} pulseCards
 * @property {Array<{ label: string, value: number, displayValue: string, note: string }>} operatingRows
 * @property {Array<AdminSignal>} signals
 * @property {Array<{ label: string, value: number, displayValue: string, note: string }>} courseComparison
 * @property {Array<CourseDiagnostic>} courseDiagnostics
 * @property {Array<LearnerWatchItem>} learnerWatchlist
 * @property {Array<RecentActivityItem>} recentActivity
 */

export {};
