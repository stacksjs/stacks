import type { RequestInstance } from '@stacksjs/types'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import FileIndexAction from './FileIndexAction'
import { DashboardFileError } from './file-manager'
import { dashboardFileFailure } from './file-response'

/**
 * File actions answer a failure they did not write with a safe 503
 * (stacksjs/stacks#3174). They rethrew it, and the router put the driver's own
 * message - `relation "storage_items" does not exist` - in the response body
 * in every environment, which the file manager then showed in its banner.
 */
const driverMessage = 'relation "storage_items" does not exist'

let quiet: ReturnType<typeof spyOn> | null = null
afterEach(() => {
  quiet?.mockRestore()
  quiet = null
})

describe('dashboardFileFailure', () => {
  test('keeps the status, message and fields of an error written to be shown', async () => {
    const reply = dashboardFileFailure(
      new DashboardFileError('Choose a limit between 1 and 5000.', 422, { limit: 'Too high.' }),
      'Files could not be loaded.',
      'FileIndexAction',
    )

    expect(reply.status).toBe(422)
    expect(await reply.json()).toEqual({ message: 'Choose a limit between 1 and 5000.', fields: { limit: 'Too high.' } })
  })

  test('answers any other failure 503 with the safe message and logs the real one', async () => {
    quiet = spyOn(console, 'error').mockImplementation(() => {})
    const failure = new Error(driverMessage)

    const reply = dashboardFileFailure(failure, 'Files could not be loaded.', 'FileIndexAction')

    expect(reply.status).toBe(503)
    expect(await reply.json()).toEqual({ message: 'Files could not be loaded.' })
    expect(quiet).toHaveBeenCalledWith('[dashboard/api] FileIndexAction failed:', failure)
  })
})

describe('FileIndexAction', () => {
  test('does not send a driver error to the browser', async () => {
    quiet = spyOn(console, 'error').mockImplementation(() => {})
    const request = {
      get: () => {
        throw new Error(driverMessage)
      },
    } as unknown as RequestInstance

    const reply = await FileIndexAction.handle(request) as Response

    expect(reply.status).toBe(503)
    const body = await reply.text()
    expect(body).not.toContain('storage_items')
    expect(JSON.parse(body)).toEqual({ message: 'Files could not be loaded.' })
  })
})
