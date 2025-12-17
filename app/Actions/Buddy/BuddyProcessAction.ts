import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'
import { applyChanges, buddyState, openRepository, processCommand } from './BuddyService'

/**
 * Process a command with the AI driver
 *
 * Accepts params via JSON body OR query string:
 * - command: The user's command/instruction (required)
 * - repo/repository: Repository path or GitHub URL (required if no repo is currently open)
 * - driver: (optional) AI driver to use (claude-cli-local, claude-cli-ec2, claude, openai, ollama, mock)
 */
export default new Action({
  name: 'BuddyProcessAction',
  description: 'Process a command with the selected AI driver',
  method: 'POST',

  validations: {
    command: {
      rule: schema.string().min(1).required(),
      message: 'Command is required',
    }
  },

  async handle(request: RequestInstance) {
    try {
      // Get params using Laravel-style methods (body is already parsed by stacks-router)
      const command = request.get<string>('command')
      const repo = request.get<string>('repo') || request.get<string>('repository')
      const driver = request.get<string>('driver')

      // Check if we need to open a repo
      const currentState = buddyState.getState()
      if (!currentState.repo) {
        if (!repo) {
          return response.unprocessableEntity('No repository is currently open. Please provide a repo path or URL.', {
            repo: ['Repository path or URL is required when no repo is currently open'],
          })
        }
        // Open the repo
        await openRepository(repo)
      }
      else if (repo && repo !== currentState.repo.path) {
        // User wants to switch to a different repo
        await openRepository(repo)
      }

      const aiResponse = await processCommand(command!, driver)
      const modifiedFiles = await applyChanges(aiResponse)

      return response.success({
        message: aiResponse,
        hasChanges: modifiedFiles.length > 0,
        modifiedFiles,
        repo: buddyState.getState().repo,
      })
    }
    catch (error) {
      console.error('[BuddyProcessAction] Error:', error)
      console.error('[BuddyProcessAction] Stack:', (error as Error).stack)
      return response.serverError((error as Error).message)
    }
  },
})
