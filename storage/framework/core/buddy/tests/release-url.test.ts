import { describe, expect, it } from 'bun:test'
import { resolveGitHubActionsUrl } from '../src/commands/release'

describe('release workflow URL', () => {
  it('uses the current HTTPS GitHub remote', () => {
    expect(resolveGitHubActionsUrl('https://github.com/chrisbbreuer/very-good-adblock.git', '', 'https://github.com'))
      .toBe('https://github.com/chrisbbreuer/very-good-adblock/actions')
  })

  it('uses the current SSH GitHub remote', () => {
    expect(resolveGitHubActionsUrl('git@github.com:stacksjs/stacks.git', '', 'https://github.com'))
      .toBe('https://github.com/stacksjs/stacks/actions')
  })

  it('prefers GitHub Actions repository metadata', () => {
    expect(resolveGitHubActionsUrl(undefined, 'owner/repo', 'https://github.example.com'))
      .toBe('https://github.example.com/owner/repo/actions')
  })
})
