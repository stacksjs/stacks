// TODO: get eslint on save formatting to work
const AWS = require('aws-sdk')

async function handler(event) {
  const requestBody = JSON.parse(event.body)
  // Extract the 'question' property from the request body
  const question = requestBody.question
  console.log(`Question received: ${question}`)
  const bedrockRuntime = new AWS.BedrockRuntime({ apiVersion: '2023-09-30' })
  const res = await bedrockRuntime.invokeModel({
    modelId: 'amazon.titan-text-express-v1',
    contentType: 'application/json',
    accept: '*/*',
    body: `{"prompt": "${question}","maxTokens":200,"temperature":0.7,"topP":1,"stopSequences":[],"countPenalty":{"scale":0},"presencePenalty":{"scale":0},"frequencyPenalty":{"scale":0}}`,
  }).promise()

  const responseBody = res.body.toString()
  return {
    statusCode: 200,
    body: responseBody,
  }
}

module.exports = {
  handler,
}
