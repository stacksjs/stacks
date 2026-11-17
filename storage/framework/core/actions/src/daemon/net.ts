import { connect } from 'node:net'

/**
 * The two questions the daemon asks of a port. Kept apart from the dashboard's
 * own helpers on purpose: those live beside the model discovery and pull the
 * string and type packages in with them, and the daemon is the one Stacks
 * process that stays in memory when nothing is being worked on.
 */

/** Whether nothing holds the port, asked by taking it for a moment. */
export async function portIsFree(port: number): Promise<boolean> {
  try {
    const server = Bun.serve({ port, fetch: () => new Response() })
    await server.stop(true)
    return true
  }
  catch {
    return false
  }
}

/** Whether something accepts a connection on the port within `timeoutMs`. */
export function portAnswers(port: number, timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' })
    const finish = (answered: boolean): void => {
      clearTimeout(timer)
      socket.destroy()
      resolve(answered)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}
