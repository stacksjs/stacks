import { describe, expect, it, mock, spyOn } from 'bun:test'
import { log } from '@stacksjs/cli'
import { ai } from '@stacksjs/config'
import { requestModelAccess } from '../src/utils/model-access'

describe('requestModelAccess', () => {
  it('should request access to AI models', async () => {
    // Mock defaultProvider
    mock.module('@aws-sdk/credential-provider-node', () => ({
      defaultProvider: () => () =>
        Promise.resolve({
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
          sessionToken: 'test-session-token',
        }),
    }))

    mock.module('@stacksjs/cli', () => ({
      log: {
        info: () => {},
        error: () => {},
      },
    }))

    // Mock AWS4 sign function
    mock.module('aws4', () => ({
      sign: (request: any) => ({
        ...request,
        headers: {
          ...request.headers,
          'X-Amz-Date': '20230101T000000Z',
          Authorization: 'AWS4-HMAC-SHA256 Credential=test/20230101/us-east-1/bedrock/aws4_request',
        },
      }),
    }))

    // Mock fetch function
    global.fetch = mock(() =>
      Promise.resolve({
        json: () => Promise.resolve({ status: 'success' }),
      } as Response),
    )

    // Spy on log.info and log.error
    const infoSpy = spyOn(log, 'info')
    const errorSpy = spyOn(log, 'error')

    await requestModelAccess()

    // Assert that fetch was called for each model
    expect(fetch).toHaveBeenCalledTimes(ai.models?.length ?? 0)

    // Check if fetch was called with correct parameters
    const fetchCalls = (fetch as any).mock.calls
    fetchCalls.forEach((call: any, index: number) => {
      expect(call[0]).toBe('https://bedrock.us-east-1.amazonaws.com/foundation-model-entitlement')
      expect(call[1].method).toBe('POST')
      expect(call[1].headers['Content-Type']).toBe('application/json')
      // @ts-expect-error
      expect(JSON.parse(call[1].body).modelId).toBe(ai.models?.[index] ?? '')
    })

    // Check if log.info was called for each model
    expect(infoSpy).toHaveBeenCalledTimes((ai.models?.length ?? 0) * 2) // Once for request, once for response

    // Check if log.error was not called
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
