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

export {};
