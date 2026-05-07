import type {
  CreateModelCustomizationJobCommandInput,
  CreateModelCustomizationJobCommandOutput,
  GetModelCustomizationJobCommandInput,
  GetModelCustomizationJobCommandOutput,
  ListFoundationModelsCommandInput,
  ListFoundationModelsCommandOutput,
} from '@stacksjs/ts-cloud/aws'
import process from 'node:process'

// Lazy-load the runtime BedrockClient. `@stacksjs/ts-cloud/aws` ships the
// type declarations but the JS bundle for that subpath isn't always
// present (we hit this on `bun install` from a registry where the package
// hadn't published the /aws bundle). Importing eagerly with a top-level
// `import { BedrockClient } from ...` crashes the entire API server at
// boot. With this shim, modules that don't actually call the helpers
// below load fine, and callers who do use Bedrock get a clear error.
let _client: any | null = null
async function getClient(): Promise<any> {
  if (_client)
    return _client
  const mod: any = await import('@stacksjs/ts-cloud/aws')
  if (!mod?.BedrockClient) {
    throw new Error(
      '@stacksjs/ts-cloud/aws does not export BedrockClient — rebuild ts-cloud or remove the AI dependency.',
    )
  }
  _client = new mod.BedrockClient(process.env.REGION || 'us-east-1')
  return _client
}

/*
 * Create Model Customization Job
 * @param {CreateModelCustomizationJobCommandInput} params
 * @returns {Promise<CreateModelCustomizationJobCommandOutput>}
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Bedrock.html#CreateModelCustomizationJob-property
 */
export async function createModelCustomizationJob(
  param: CreateModelCustomizationJobCommandInput,
): Promise<CreateModelCustomizationJobCommandOutput> {
  const client = await getClient()
  return client.createModelCustomizationJob(param)
}

/*
 * Get Model Customization Job
 * @param {GetModelCustomizationJobCommandInput} params
 * @returns {Promise<GetModelCustomizationJobCommandOutput>}
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Bedrock.html#getModelCustomizationJob-property
 */
export async function getModelCustomizationJob(
  params: GetModelCustomizationJobCommandInput,
): Promise<GetModelCustomizationJobCommandOutput> {
  const client = await getClient()
  return client.getModelCustomizationJob(params)
}

/*
 * List Foundation Models
 * @param {ListFoundationModelsCommandInput} params
 * @returns {Promise<ListFoundationModelsCommandOutput>}
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Bedrock.html#listFoundationModels-property
 */
export async function listFoundationModels(
  params: ListFoundationModelsCommandInput,
): Promise<ListFoundationModelsCommandOutput> {
  const client = await getClient()
  return client.listFoundationModels(params)
}

export type {
  CreateModelCustomizationJobCommandInput,
  GetModelCustomizationJobCommandInput,
  ListFoundationModelsCommandInput,
}
