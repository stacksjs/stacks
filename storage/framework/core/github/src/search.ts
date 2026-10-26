import type { GitHubClientOptions } from './client'
import { githubJson } from './client'

export interface GitHubSearchPage<T> { total_count: number, incomplete_results: boolean, items: T[] }
export interface GitHubRepositoryResult { id: number, full_name: string, description: string | null, html_url: string, private: boolean, stargazers_count: number }
export interface GitHubIssueResult { id: number, number: number, title: string, html_url: string, state: string, repository_url: string, updated_at: string, pull_request?: { url: string }, user: { login: string } }
export interface GitHubNotification { id: string, unread: boolean, reason: string, updated_at: string, repository: { full_name: string, html_url: string }, subject: { title: string, type: string, url: string | null } }
export interface GitHubViewer { login: string, avatar_url: string, html_url: string }

/** GitHub's native search syntax is retained, including repo:, org: and user:. */
export function searchGitHubRepositories(query: string, options: GitHubClientOptions = {}): Promise<GitHubSearchPage<GitHubRepositoryResult>> {
  return githubJson(`/search/repositories?per_page=30&q=${encodeURIComponent(query.trim())}`, {}, options)
}

export function searchGitHubIssues(query: string, kind: 'issue' | 'pr', options: GitHubClientOptions = {}): Promise<GitHubSearchPage<GitHubIssueResult>> {
  return githubJson(`/search/issues?per_page=30&sort=updated&q=${encodeURIComponent(`is:${kind} ${query.trim()}`)}`, {}, options)
}

export function fetchGitHubNotifications(options: GitHubClientOptions = {}): Promise<GitHubNotification[]> {
  return githubJson('/notifications?per_page=50', {}, options)
}

export function fetchGitHubViewer(options: GitHubClientOptions = {}): Promise<GitHubViewer> {
  return githubJson('/user', {}, options)
}
