import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { applyChanges, processCommand } from './BuddyService'

/**
 * Process a command with the AI driver
 *
 * Request body:
 * - command: The user's command/instruction
 * - driver: (optional) AI driver to use (claude, openai, ollama, mock)
 */
export default new Action({
  name: 'BuddyProcessAction',
  description: 'Process a command with the selected AI driver',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      const body = await request.json() as { command: string, driver?: string }
      const { command, driver } = body

      if (!command) {
        return response.json({ success: false, error: 'Command is required' }, { status: 400 })
      }

      const aiResponse = await processCommand(command, driver)
      const modifiedFiles = await applyChanges(aiResponse)

      return response.json({
        success: true,
        message: aiResponse,
        hasChanges: modifiedFiles.length > 0,
        modifiedFiles,
      })
    }
    catch (error) {
      return response.json({ success: false, error: (error as Error).message }, { status: 400 })
    }
  },
})
