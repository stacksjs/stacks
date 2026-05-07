import type {
  InvokeModelCommandInput,
  InvokeModelCommandOutput,
  InvokeModelWithResponseStreamCommandInput,
  InvokeModelWithResponseStreamCommandOutput,
} from '@stacksjs/ts-cloud/aws'
import process from 'node:process'

// Lazy-load the runtime BedrockRuntimeClient — see client-bedrock.ts
// for the rationale (ts-cloud's /aws subpath ships types but not always
// the JS bundle, and an eager top-level import takes the whole API
// server down at boot).
let _client: any | null = null
async function getClient(): Promise<any> {
  if (_client)
    return _client
  const mod: any = await import('@stacksjs/ts-cloud/aws')
  if (!mod?.BedrockRuntimeClient) {
    throw new Error(
      '@stacksjs/ts-cloud/aws does not export BedrockRuntimeClient — rebuild ts-cloud or remove the AI dependency.',
    )
  }
  _client = new mod.BedrockRuntimeClient(process.env.REGION || 'us-east-1')
  return _client
}

/*
 * Invoke Model
 * @param {InvokeModelCommandInput} params
 * @returns {Promise<InvokeModelCommandOutput>}
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/BedrockRuntime.html#invokeModel-property
 */
export async function invokeModel(params: InvokeModelCommandInput): Promise<InvokeModelCommandOutput> {
  const c = await getClient()
  return c.invokeModel(params)
}

/*
 * Invoke Model With Response Stream
 * @param {InvokeModelWithResponseStreamCommandInput} params
 * @returns {Promise<InvokeModelWithResponseStreamCommandOutput>}
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/BedrockRuntime.html#invokeModelWithResponseStream-property
 */
export async function invokeModelWithResponseStream(
  params: InvokeModelWithResponseStreamCommandInput,
): Promise<InvokeModelWithResponseStreamCommandOutput> {
  const c = await getClient()
  return c.invokeModelWithResponseStream(params)
}

export type { InvokeModelCommandInput, InvokeModelWithResponseStreamCommandInput }
