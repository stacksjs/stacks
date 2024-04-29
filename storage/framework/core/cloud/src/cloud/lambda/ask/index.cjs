const AWS = require('aws-sdk')

async function handler(event) {
  const requestBody = JSON.parse(event.body)

  // Extract the 'question' property from the request body
  const question = requestBody.question
  // eslint-disable-next-line no-console
  console.log(`Question received: ${question}`)

  const bedrockRuntime = new AWS.BedrockRuntime({ apiVersion: '2023-09-30' })
  const res = await bedrockRuntime
    .invokeModel({
      modelId: 'amazon.titan-text-express-v1',
      contentType: 'application/json',
      accept: '*/*',
      body: JSON.stringify({
        inputText: question,
        textGenerationConfig: {
          maxTokenCount: 300,
          stopSequences: [],
          temperature: 0.1,
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
