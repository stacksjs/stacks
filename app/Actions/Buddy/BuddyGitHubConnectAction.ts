import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import type { GitHubCredentials } from './BuddyService'
import { buddyState } from './BuddyService'

/**
 * Connect a GitHub account for commits
 *
 * Request body:
 * - token: GitHub personal access token
 * - username: GitHub username
 * - name: Display name for git commits
 * - email: Email for git commits
 */
export default new Action({
  name: 'BuddyGitHubConnectAction',
  description: 'Connect a GitHub account for authenticated operations',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      const body = await request.json() as GitHubCredentials
      const { token, username, name, email } = body

      if (!token || !username || !name || !email) {
        return response.json({
          success: false,
          error: 'token, username, name, and email are required',
        }, { status: 400 })
      }

      buddyState.setGitHub({ token, username, name, email })
      console.log(`GitHub connected: ${username} <${email}>`)

      return response.json({ success: true, username, name, email })
    }
    catch (error) {
      return response.json({ success: false, error: (error as Error).message }, { status: 400 })
    }
  },
})
