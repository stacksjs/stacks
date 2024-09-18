import { describe, expect, it, mock } from 'bun:test'
import { requestModelAccess } from '@stacksjs/ai'
import { ai } from '@stacksjs/config'
import { config } from 'aws-sdk'
import * as AWS4 from 'aws4'

describe('requestModelAccess', () => {
  it('should request access to AI models', async () => {
    // Mock AWS SDK config
    mock.module('aws-sdk', () => ({
      config: {
        getCredentials: (callback: (error: Error | null) => void) => callback(null),
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
          sessionToken: 'test-session-token',
        },
      },
    }))

    // Mock AWS4 sign function
    mock.module('aws4', () => ({
      sign: (request: any) => request,
    }))

    // Mock fetch function
    global.fetch = mock(() =>
      Promise.resolve({
        json: () => Promise.resolve({ status: 'success' }),
      }),
    )

    // Mock ai config
    mock.module('@stacksjs/config', () => ({
      ai: {
        models: ['test-model-1', 'test-model-2'],
      },
    }))

    await requestModelAccess()

    // Assert that fetch was called for each model
    expect(fetch).toHaveBeenCalledTimes(ai.models.length)
  })
})
