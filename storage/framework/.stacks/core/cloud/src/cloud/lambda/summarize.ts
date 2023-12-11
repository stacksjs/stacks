import type { APIGatewayEvent, APIGatewayProxyHandler } from 'aws-cdk-lib/aws-lambda'
import type { InvokeModelResponse } from '@aws-sdk/client-bedrock-runtime'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const bedrockClient = new BedrockRuntimeClient()

export const handler: APIGatewayProxyHandler = async (event: APIGatewayEvent, context) => {
  const body = JSON.parse(event.body || '')
  console.log('Body', event.body)

  const input = {
    modelId: 'amazon.titan-text-lite-v1',
    contentType: 'application/json',
    accept: '*/*',
    body: JSON.stringify({
      inputText: `Summarise the following text: "${body.inputText || ''}"`,
      textGenerationConfig: {
        maxTokenCount: 512,
        stopSequences: [],
        temperature: 0,
        topP: 0.9,
      },
    }),
  }
  const rawResponse: InvokeModelResponse = await bedrockClient.send(new InvokeModelCommand(input))
  const modelResponse = JSON.parse(
    new TextDecoder().decode(rawResponse.body),
  ) as {
    inputTextTokenCount: number
    results: [{
      tokenCount: number
      outputText: string
      completionReason: string
    }]
  }
  const summary = modelResponse.results[0].outputText

  return {
    statusCode: 200,
    body: JSON.stringify({ summary }),
  }
}
