/**
 * @stacksjs/github — thin GitHub API client used by Stacks framework
 * features (dashboard CI surface, future runner alerts, kanban→PR links).
 *
 * Top-level entry: {@link getDashboardData} returns the aggregated snapshot
 * the dashboard renders. Lower-level helpers (`fetchAllRepos`,
 * `fetchRepoStatus`, …) are also exported so other surfaces can pull a
 * single dimension without pulling the whole snapshot through.
 */

export { fetchBotPRCounts } from './bots'
export { ghFetch, ghHeaders, GITHUB_API, mapWithConcurrency } from './client'
export { clearDashboardCache, getDashboardData } from './dashboard'
export { detectNewlyFailedRuns } from './failure-detector'
export type { DetectOptions, FailedTransition, PreviousRunState } from './failure-detector'
export { fetchAllRepos } from './repos'
export { fetchRepoActiveRuns } from './runners'
export { fetchRunJobs, fetchWorkflowRuns } from './run-history'
export type { WorkflowJob, WorkflowRun } from './run-history'
export { detectRunnerPressure } from './runner-pressure-detector'
export type {
  DetectOptions as PressureDetectOptions,
  PressureAction,
  RunnerAlertState,
  RunnerSample,
} from './runner-pressure-detector'
export { fetchFailedJobs, fetchRepoStatus } from './runs'
export type {
  DashboardData,
  DashboardOptions,
  FailedJob,
  OrgRunnerUsage,
  Repo,
  RepoStatus,
  RepoStatusKind,
} from './types'
