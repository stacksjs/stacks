import type {
  CreateModelCustomizationJobCommandInput,
  CreateModelCustomizationJobCommandOutput,
  GetModelCustomizationJobCommandInput,
  GetModelCustomizationJobCommandOutput,
  ListFoundationModelsCommandInput,
  ListFoundationModelsCommandOutput,
} from '@stacksjs/ts-cloud/aws'
import process from 'node:process'
import { BedrockClient } from '@stacksjs/ts-cloud/aws'

const client = new BedrockClient(process.env.REGION || 'us-east-1')
const logger = console // import your own logger

/*
 * Create Model Customization Job
 * @param {CreateModelCustomizationJobCommandInput} params
 * @returns {Promise<CreateModelCustomizationJobCommandOutput>}
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Bedrock.html#CreateModelCustomizationJob-property
 */
export async function createModelCustomizationJob(
  param: CreateModelCustomizationJobCommandInput,
): Promise<CreateModelCustomizationJobCommandOutput> {
  logger.debug(param)
  const res = await client.createModelCustomizationJob(param)
  logger.debug('Successfully create model customization job')
  logger.debug(res)
  return res
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
  logger.debug(params)
  const res = await client.getModelCustomizationJob(params)
  logger.debug('Successfully get model customization job')
  logger.debug(res)
  return res
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
  logger.debug(params)
  const res = await client.listFoundationModels(params)
  logger.debug('Successfully list foundation models')
  logger.debug(res)
  return res
}

export type {
  CreateModelCustomizationJobCommandInput,
  GetModelCustomizationJobCommandInput,
  ListFoundationModelsCommandInput,
}
