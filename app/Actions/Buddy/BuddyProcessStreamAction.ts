import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { applyChanges, buddyState, openRepository, processCommandStreaming } from './BuddyService'

/**
 * Process a command with streaming output (Server-Sent Events)
 *
 * This endpoint streams Claude CLI output in real-time as it's generated.
 * Use EventSource or fetch with streaming to consume this endpoint.
 *
 * Request body:
 * - command: The user's command/instruction (required)
 * - repo/repository: Repository path or GitHub URL (required if no repo is currently open)
 * - driver: (optional) AI driver to use (only claude-cli-local supports streaming)
 */
export default new Action({
  name: 'BuddyProcessStreamAction',
  description: 'Process a command with streaming AI output',
  method: 'POST',

  async handle(request: RequestInstance) {
    try {
      const command = request.get<string>('command')
      const repo = request.get<string>('repo') || request.get<string>('repository')
      const driver = request.get<string>('driver')

      if (!command) {
        return new Response(JSON.stringify({ error: 'Command is required' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Check if we need to open a repo
      const currentState = buddyState.getState()
      if (!currentState.repo) {
        if (!repo) {
          return new Response(JSON.stringify({
            error: 'No repository is currently open. Please provide a repo path or URL.',
          }), {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        await openRepository(repo)
      }
      else if (repo && repo !== currentState.repo.path) {
        await openRepository(repo)
      }

      // Start streaming
      const { stream, fullResponse } = await processCommandStreaming(command, driver || undefined)

      // Create SSE response
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()

      const sseStream = new ReadableStream({
        async start(controller) {
          // Send initial event
          controller.enqueue(encoder.encode(`event: start\ndata: ${JSON.stringify({ status: 'processing' })}\n\n`))

          const reader = stream.getReader()

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              // Convert chunk to text and send as SSE data event
              const text = decoder.decode(value, { stream: true })
              // Escape newlines for SSE format
              const escapedText = text.replace(/\n/g, '\\n')
              controller.enqueue(encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`))
            }

            // Wait for full response and apply changes
            const response = await fullResponse
            const modifiedFiles = await applyChanges(response)

            // Send completion event with metadata
            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({
              status: 'complete',
              hasChanges: modifiedFiles.length > 0,
              modifiedFiles,
              repo: buddyState.getState().repo,
            })}\n\n`))

            controller.close()
          }
          catch (error) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({
              error: (error as Error).message,
            })}\n\n`))
            controller.close()
          }
        },
      })

      return new Response(sseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }
    catch (error) {
      console.error('[BuddyProcessStreamAction] Error:', error)
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
})
