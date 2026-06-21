export { ScrutinyError } from "./errors.js";
export {
  classifyTicket,
  TIER_PERCENTAGES,
  OPERATOR_RESERVE_PERCENT,
  TIER_COUNT,
} from "./tiers.js";
export type { Tier } from "./tiers.js";
export { distributePool } from "./pool.js";
export type { TierResult, DistributionResult } from "./pool.js";
