import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

export const handler = async (event) => {
  const requestBody = JSON.parse(event.body)

  // Extract the 'text' property from the request body
  const text = requestBody.text
  console.log(`Text received: ${text}`)

  const bedrockRuntime = new BedrockRuntimeClient({ region: 'us-east-1' })
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-text-express-v1',
    contentType: 'application/json',
    accept: '*/*',
    body: JSON.stringify({
      inputText: `Summarize the following text: ${text}`,
      textGenerationConfig: {
        maxTokenCount: 512,
        stopSequences: [],
        temperature: 0,
        topP: 0.9,
      },
    }),
  })

  try {
    const response = await bedrockRuntime.send(command)
    return {
      statusCode: 200,
      body: new TextDecoder().decode(response.body),
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An error occurred while processing your request.' }),
    }
  }
}
