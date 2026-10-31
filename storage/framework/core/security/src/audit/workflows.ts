import type { Finding } from './types'

/** Event fields an outsider controls: text a pull request, issue or commit carries. */
const UNTRUSTED = /\$\{\{\s*(?:github\.event\.(?:issue\.(?:title|body)|pull_request\.(?:title|body|head\.(?:ref|label|repo\.default_branch))|comment\.body|review\.body|review_comment\.body|pages\.[\w.*]+\.page_name|commits\.[\w.*]+\.(?:message|author\.(?:email|name))|head_commit\.(?:message|author\.(?:email|name))|discussion\.(?:title|body))|github\.head_ref|github\.event\.workflow_run\.(?:head_branch|head_commit\.message))\s*\}\}/

function indentOf(line: string): number {
  return line.length - line.trimStart().length
}

/**
 * GitHub Actions workflows (`.github/workflows/*.yml`). Pure, line-based: the
 * YAML shapes that turn a pull request, an issue title or a branch name into
 * code running with the repository's secrets.
 */
export function scanWorkflow(path: string, text: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split('\n')
  const add = (rule: string, severity: Finding['severity'], title: string, index: number, fix: string) =>
    findings.push({ rule, check: 'workflows', severity, title, file: path, line: index + 1, detail: lines[index]!.trim().slice(0, 160), fix })

  const targetsPullRequestTarget = lines.some(line => /^\s*(?:on:\s*.*\bpull_request_target\b|pull_request_target\s*:)/.test(line))
  const hasPermissions = lines.some(line => /^permissions\s*:/.test(line))
  if (!hasPermissions && lines.some(line => /^jobs\s*:/.test(line)))
    findings.push({ rule: 'workflow/default-permissions', check: 'workflows', severity: 'low', title: 'No top-level `permissions:`, so jobs get the repository\'s default token scope', file: path, line: 1, fix: 'Add `permissions: { contents: read }` and widen it per job.' })

  let runIndent = -1
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const indent = indentOf(line)
    if (runIndent >= 0 && indent <= runIndent) runIndent = -1

    const runMatch = /^(\s*)(?:-\s+)?run\s*:\s*(.*)$/.exec(line)
    if (runMatch) {
      runIndent = (runMatch[1] ?? '').length + (line.includes('- run') ? 2 : 0)
      const inline = runMatch[2] ?? ''
      if (UNTRUSTED.test(inline)) add('workflow/script-injection', 'high', 'Untrusted text is pasted into a shell command', index, 'Pass it as an environment variable (env: TITLE: ${{ … }}) and use "$TITLE" in the script.')
      if (/echo\s+["']?\$\{\{\s*secrets\.[^|>]*$/.test(inline)) add('workflow/secret-echo', 'high', 'A secret is echoed into the log', index, 'Never print secrets; pass them as environment variables to the command that needs them.')
      continue
    }
    if (runIndent >= 0 && indent > runIndent) {
      if (UNTRUSTED.test(line)) add('workflow/script-injection', 'high', 'Untrusted text is pasted into a shell command', index, 'Pass it as an environment variable (env: TITLE: ${{ … }}) and use "$TITLE" in the script.')
      if (/echo\s+["']?\$\{\{\s*secrets\.[^|>]*$/.test(line)) add('workflow/secret-echo', 'high', 'A secret is echoed into the log', index, 'Never print secrets; pass them as environment variables to the command that needs them.')
    }

    if (targetsPullRequestTarget && /ref\s*:\s*\$\{\{\s*github\.event\.pull_request\.head\.(?:sha|ref)/.test(line))
      add('workflow/pull-request-target-checkout', 'critical', 'pull_request_target checks out the pull request\'s code, with the repository\'s secrets', index, 'Use `pull_request`, or run the untrusted code in a separate workflow without secrets.')

    const uses = /^\s*-?\s*uses\s*:\s*([^\s@#]+)@([^\s#]+)/.exec(line)
    if (uses && !uses[1]!.startsWith('./') && /^(?:main|master|HEAD|latest)$/.test(uses[2]!))
      add('workflow/moving-action-ref', 'medium', `Action ${uses[1]} follows a branch, so its code can change under you`, index, 'Pin a release tag or a commit SHA.')
  }
  return findings
}
