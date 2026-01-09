import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { applyChanges, buddyProcessStreaming, buddyState, buddyStreamSimple, openRepository } from '@stacksjs/ai'

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
 * - mode: (optional) 'simple' for Q&A with true token-by-token streaming, 'agentic' for tool use (default)
 */
export default new Action({
  name: 'BuddyProcessStreamAction',
  description: 'Process a command with streaming AI output',
  method: 'POST',

  async handle(request: RequestInstance) {
    try {
      const command = request.get('command')
      const repo = request.get('repo') || request.get('repository')
      const driver = request.get('driver')
      const history = request.get('history') as Array<{role: string; content: string}> | undefined
      const mode = request.get('mode') as string | undefined // 'simple' or 'agentic'

      if (!command) {
        return new Response(JSON.stringify({ error: 'Command is required' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Check if we need to open a repo (only required for agentic mode)
      const currentState = buddyState.getState()
      if (mode !== 'simple') {
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
      }

      // Start streaming - use simple mode for Q&A (true token-by-token streaming)
      // or agentic mode for tool use (CLI-based streaming)
      const { stream, fullResponse } = mode === 'simple'
        ? await buddyStreamSimple(command, history)
        : await buddyProcessStreaming(command, driver || undefined, history)

      // Create SSE response
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()

      const isSimpleMode = mode === 'simple'
      const sseStream = new ReadableStream({
        async start(controller) {
          // Send initial event
          controller.enqueue(encoder.encode(`event: start\ndata: ${JSON.stringify({ status: 'processing', mode: isSimpleMode ? 'simple' : 'agentic' })}\n\n`))

          const reader = stream.getReader()

          try {
            let result = await reader.read()
            while (!result.done) {
              // Convert chunk to text and send as SSE data event
              const text = decoder.decode(result.value, { stream: true })
              controller.enqueue(encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`))
              result = await reader.read()
            }

            // Wait for full response
            const response = await fullResponse

            // Only apply changes for agentic mode (simple mode has no file changes)
            let modifiedFiles: string[] = []
            if (!isSimpleMode) {
              modifiedFiles = await applyChanges(response)
            }

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
