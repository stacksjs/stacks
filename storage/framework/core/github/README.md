# @stacksjs/github

GitHub API client used by Stacks framework features. Currently powers the
dashboard CI surface ([#1844](https://github.com/stacksjs/stacks/issues/1844));
designed to be reused by future surfaces (failing-CI notifications, runner
alerts, kanban→PR links, etc.).

## What's in here

- `getDashboardData()` — aggregated CI/runner snapshot across a configured

  list of orgs, with on-disk caching and stale-while-revalidate semantics.

- Lower-level helpers (`fetchAllRepos`, `fetchRepoStatus`, `fetchBotPRCounts`,

  `fetchRepoActiveRuns`) for callers that need a single dimension.

- A retrying `ghFetch` that respects GitHub's `Retry-After` /

  `x-ratelimit-reset` headers so callers don't have to.

## Auth

A `GITHUB_TOKEN` environment variable is required. The token only needs
`public_repo` scope for the default reads — bump permissions only if you
add endpoints that need them.
