import type {
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandOutput,
  InvokeModelCommandInput,
  InvokeModelCommandOutput,
  InvokeModelWithResponseStreamCommandInput,
  InvokeModelWithResponseStreamCommandOutput,
} from '@stacksjs/ts-cloud/aws'
import process from 'node:process'

/**
 * The region Bedrock is called in: the one passed, then `AWS_REGION`, then
 * `AWS_DEFAULT_REGION` (what the scaffolded `.env` sets), then us-east-1.
 *
 * These clients used to read `REGION`, which nothing sets, so Bedrock was
 * always called in us-east-1 whatever the application configured.
 */
export function bedrockRegion(region?: string): string {
  return region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
}

// Lazy-load the runtime BedrockRuntimeClient — see client-bedrock.ts
// for the rationale (ts-cloud's /aws subpath ships types but not always
// the JS bundle, and an eager top-level import takes the whole API
// server down at boot). One client per region.
const clients = new Map<string, any>()
async function getClient(region?: string): Promise<any> {
  const resolved = bedrockRegion(region)
  const cached = clients.get(resolved)
  if (cached)
    return cached
  const mod: any = await import('@stacksjs/ts-cloud/aws')
  if (!mod?.BedrockRuntimeClient) {
    throw new Error(
      '@stacksjs/ts-cloud/aws does not export BedrockRuntimeClient - rebuild ts-cloud or remove the AI dependency.',
    )
  }
  const client = new mod.BedrockRuntimeClient(resolved)
  clients.set(resolved, client)
  return client
}

/*
 * Converse - one request shape for every Bedrock text model
 * @see https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html
 */
export async function converse(params: ConverseCommandInput, region?: string): Promise<ConverseCommandOutput> {
  const c = await getClient(region)
  return c.converse(params)
}

/*
 * Converse, streamed: the same request, answered as events
 * @see https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html
 */
export async function converseStream(params: ConverseCommandInput, region?: string): Promise<ConverseStreamCommandOutput> {
  const c = await getClient(region)
  if (typeof c.converseStream !== 'function')
    throw new Error('This @stacksjs/ts-cloud cannot stream the Converse API: upgrade it to 0.16.44 or newer.')
  return c.converseStream(params)
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

export type { ConverseCommandInput, ConverseCommandOutput, InvokeModelCommandInput, InvokeModelWithResponseStreamCommandInput }
