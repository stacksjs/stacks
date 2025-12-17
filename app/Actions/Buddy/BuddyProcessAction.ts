import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { applyChanges, buddyState, openRepository, processCommand } from './BuddyService'

/**
 * Process a command with the AI driver
 *
 * Request body:
 * - command: The user's command/instruction
 * - repo: Repository path or GitHub URL (required if no repo is currently open)
 * - driver: (optional) AI driver to use (claude-cli-local, claude-cli-ec2, claude, openai, ollama, mock)
 */
export default new Action({
  name: 'BuddyProcessAction',
  description: 'Process a command with the selected AI driver',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      const body = await request.json() as { command: string, repo?: string, driver?: string }
      const { command, repo, driver } = body

      if (!command) {
        return response.json({ success: false, error: 'Command is required' }, { status: 400 })
      }

      // Check if we need to open a repo
      const currentState = buddyState.getState()
      if (!currentState.repo) {
        if (!repo) {
          return response.json({
            success: false,
            error: 'No repository is currently open. Please provide a repo path or URL.',
          }, { status: 400 })
        }
        // Open the repo
        await openRepository(repo)
      }
      else if (repo && repo !== currentState.repo.path) {
        // User wants to switch to a different repo
        await openRepository(repo)
      }

      const aiResponse = await processCommand(command, driver)
      const modifiedFiles = await applyChanges(aiResponse)

      return response.json({
        success: true,
        message: aiResponse,
        hasChanges: modifiedFiles.length > 0,
        modifiedFiles,
        repo: buddyState.getState().repo,
      })
    }
    catch (error) {
      return response.json({ success: false, error: (error as Error).message }, { status: 400 })
    }
  },
})
