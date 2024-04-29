const AWS = require('aws-sdk')

async function handler(event) {
  const requestBody = JSON.parse(event.body)

  // Extract the 'question' property from the request body
  const text = requestBody.text
  console.log(`Text received: ${text}`)

  const bedrockRuntime = new AWS.BedrockRuntime({ apiVersion: '2023-09-30' })
  const res = await bedrockRuntime
    .invokeModel({
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
    .promise()

  return {
    statusCode: 200,
    body: res.body.toString(),
  }
}

module.exports = {
  handler,
}
