import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import {
  BedrockClient,
  CreateModelCustomizationJobCommand,
  GetModelCustomizationJobCommand,
  ListFoundationModelsCommand,
} from '@aws-sdk/client-bedrock'
import { log } from '@stacksjs/cli'
import { ai } from '@stacksjs/config'
import { mockClient } from 'aws-sdk-client-mock'
import {
  createModelCustomizationJob,
  getModelCustomizationJob,
  listFoundationModels,
} from '../src/utils/client-bedrock'
import { requestModelAccess } from '../src/utils/model-access'

const bedrockMock = mockClient(BedrockClient)

const MOCK_ACCESS_KEY = 'test-access-key'
const MOCK_SECRET_KEY = 'test-secret-key'
const MOCK_SESSION_TOKEN = 'test-session-token'
const MOCK_BEDROCK_URL = 'https://bedrock.us-east-1.amazonaws.com/foundation-model-entitlement'

describe('@stacksjs/ai', () => {
  beforeEach(() => {
    // Mock defaultProvider
    mock.module('@aws-sdk/credential-provider-node', () => ({
      defaultProvider: () => () =>
        Promise.resolve({
          accessKeyId: MOCK_ACCESS_KEY,
          secretAccessKey: MOCK_SECRET_KEY,
          sessionToken: MOCK_SESSION_TOKEN,
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
          'Authorization': 'AWS4-HMAC-SHA256 Credential=test/20230101/us-east-1/bedrock/aws4_request',
        },
      }),
    }))

    // Mock fetch function
    globalThis.fetch = mock(() =>
      Promise.resolve({
        json: () => Promise.resolve({ status: 'success' }),
      } as Response),
    )

    bedrockMock.reset()
  })

  afterEach(() => {
    mock.restore()
  })

  it('should request access to AI models', async () => {
    const infoSpy = spyOn(log, 'info')
    const errorSpy = spyOn(log, 'error')

    await requestModelAccess()

    expect(fetch).toHaveBeenCalledTimes(ai.models?.length ?? 0)

    const fetchCalls = (fetch as any).mock.calls
    fetchCalls.forEach((call: any, index: number) => {
      expect(call[0]).toBe(MOCK_BEDROCK_URL)
      expect(call[1].method).toBe('POST')
      expect(call[1].headers['Content-Type']).toBe('application/json')
      expect((JSON.parse(call[1].body) as any).modelId).toBe(ai.models?.[index] ?? '')
    })

    expect(infoSpy).toHaveBeenCalledTimes((ai.models?.length ?? 0) * 2)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('should handle errors when requesting access', async () => {
    const errorSpy = spyOn(log, 'error')
    globalThis.fetch = mock(() => Promise.reject(new Error('Network error')))

    await requestModelAccess()

    expect(errorSpy).toHaveBeenCalled()
  })

  it('should handle undefined ai.models', async () => {
    const originalModels = ai.models
    ai.models = undefined

    const infoSpy = spyOn(log, 'info')

    await expect(requestModelAccess()).rejects.toThrow('No AI models found')

    expect(infoSpy).not.toHaveBeenCalled()

    ai.models = originalModels
  })

  it('should create model customization job', async () => {
    const mockResponse = {
      $metadata: {
        httpStatusCode: 200,
        requestId: 'test-request-id',
        attempts: 1,
        totalRetryDelay: 0,
      },
      jobArn: 'arn:aws:bedrock:us-east-1:123456789012:model-customization-job/example-job',
      jobName: 'example-job',
      jobStatus: 'IN_PROGRESS',
    }

    bedrockMock.on(CreateModelCustomizationJobCommand).resolves(mockResponse)

    const result = await createModelCustomizationJob({
      jobName: 'example-job',
      customModelName: 'my-custom-model',
      baseModelIdentifier: 'anthropic.claude-v2',
      trainingDataConfig: {
        s3Uri: 's3://example-bucket/training-data',
      },
      outputDataConfig: {
        s3Uri: 's3://example-bucket/output-data',
      },
      roleArn: 'arn:aws:iam::123456789012:role/BedrockModelCustomizationRole',
      hyperParameters: {},
    })

    expect(result).toEqual(mockResponse)
    expect(bedrockMock.calls()).toHaveLength(1)
    expect(bedrockMock.call(0).args[0].input).toMatchObject({
      jobName: 'example-job',
      customModelName: 'my-custom-model',
      baseModelIdentifier: 'anthropic.claude-v2',
      trainingDataConfig: {
        s3Uri: 's3://example-bucket/training-data',
      },
      outputDataConfig: {
        s3Uri: 's3://example-bucket/output-data',
      },
      roleArn: 'arn:aws:iam::123456789012:role/BedrockModelCustomizationRole',
      hyperParameters: {},
    })
  })

  it('should get model customization job', async () => {
    const mockResponse = {
      $metadata: {
        httpStatusCode: 200,
        requestId: 'test-request-id',
        attempts: 1,
        totalRetryDelay: 0,
      },
      jobArn: 'arn:aws:bedrock:us-east-1:123456789012:model-customization-job/example-job',
      jobName: 'example-job',
      jobStatus: 'COMPLETED',
      modelId: 'example-model',
      baseModelIdentifier: 'anthropic.claude-v2',
      outputModelName: 'my-custom-model',
      roleArn: 'arn:aws:iam::123456789012:role/BedrockModelCustomizationRole',
      creationTime: new Date(),
      baseModelArn: 'arn:aws:bedrock:us-east-1:123456789012:foundation-model/anthropic.claude-v2',
      lastModifiedTime: new Date(),
      trainingDataConfig: {
        s3Uri: 's3://example-bucket/training-data',
      },
      validationDataConfig: {
        s3Uri: 's3://example-bucket/validation-data',
      },
      outputDataConfig: {
        s3Uri: 's3://example-bucket/output-data',
      },
      hyperParameters: {},
      trainingMetrics: {
        trainingLoss: 0.1,
        validationLoss: 0.2,
        epochsCompleted: 10,
      },
    }

    bedrockMock.on(GetModelCustomizationJobCommand).resolves(mockResponse)

    const result = await getModelCustomizationJob({
      jobIdentifier: 'example-job',
    })

    expect(result).toEqual(mockResponse)
    expect(bedrockMock.calls()).toHaveLength(1)
    expect(bedrockMock.call(0).args[0].input).toMatchObject({
      jobIdentifier: 'example-job',
    })
  })

  it('should list foundation models', async () => {
    const mockResponse = {
      $metadata: {
        httpStatusCode: 200,
        requestId: 'test-request-id',
        attempts: 1,
        totalRetryDelay: 0,
      },
      modelSummaries: [
        {
          modelId: 'anthropic.claude-v2',
          modelName: 'Claude V2',
          providerName: 'Anthropic',
        },
        {
          modelId: 'ai21.j2-ultra',
          modelName: 'Jurassic-2 Ultra',
          providerName: 'AI21 Labs',
        },
      ],
    }

    bedrockMock.on(ListFoundationModelsCommand).resolves(mockResponse)

    const result = await listFoundationModels({})

    expect(result).toEqual(mockResponse)
    expect(bedrockMock.calls()).toHaveLength(1)
    expect(bedrockMock.call(0).args[0].input).toMatchObject({})
  })

  it('should handle errors in Bedrock client calls', async () => {
    bedrockMock.on(CreateModelCustomizationJobCommand).rejects(new Error('AWS Error'))

    await expect(
      createModelCustomizationJob({
        jobName: 'example-job',
        customModelName: 'my-custom-model',
        baseModelIdentifier: 'anthropic.claude-v2',
        trainingDataConfig: {
          s3Uri: 's3://example-bucket/training-data',
        },
        outputDataConfig: {
          s3Uri: 's3://example-bucket/output-data',
        },
        roleArn: 'arn:aws:iam::123456789012:role/BedrockModelCustomizationRole',
        hyperParameters: {},
      }),
    ).rejects.toThrow('AWS Error')
  })
})
