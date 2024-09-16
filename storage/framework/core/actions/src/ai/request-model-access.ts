import process from 'node:process'
import * as AWS4 from 'aws4'
import { log } from '@stacksjs/cli'
import { ai } from '@stacksjs/config'
import { config } from 'aws-sdk'

// Specify the AWS profile
// process.env.AWS_PROFILE = 'your-profile-name' -> no need to define this because of our .env file
process.env.AWS_REGION = 'us-east-1'

config.getCredentials((err) => {
  if (err) {
    log.info(err.stack)
  } else if (config.credentials) {
    const { accessKeyId, secretAccessKey, sessionToken } = config.credentials
    log.info('AWS credentials are set', accessKeyId, secretAccessKey, sessionToken)

    const endpoint = 'https://bedrock.us-east-1.amazonaws.com/foundation-model-entitlement'
    const region = 'us-east-1'
    const service = 'bedrock'

    const models = ai.models

    if (!models) {
      log.error('No AI models found. Please set ./config/ai.ts values.')
      return
    }

    for (const model of models) {
      log.info(`Requesting access to model ${model}`)
      const request = {
        host: 'bedrock.us-east-1.amazonaws.com',
        method: 'POST',
        url: endpoint,
        path: '/foundation-model-entitlement',
        headers: {
          'Content-Type': 'application/json',
          authority: 'http://bedrock.us-east-1.amazonaws.com',
        },
        body: JSON.stringify({ modelId: model }), // use the current model in the loop
        service,
        region,
      }

      // Sign the request
      const signedRequest = AWS4.sign(request, {
        accessKeyId,
        secretAccessKey,
        sessionToken,
      })

      // Convert headers to the correct type
      const headers = Object.fromEntries(
        Object.entries(signedRequest.headers || {}).map(([key, value]) => [key, String(value)]),
      )

      const url = `https://${signedRequest.host}${signedRequest.path}`

      // Send the request
      fetch(url, {
        method: signedRequest.method,
        headers,
        body: signedRequest.body,
      })
        .then((response) => response.json())
        .then((data) => {
          log.info(data)
        })
        .catch((error) => {
          log.error('Error:', error)
        })
    }
  }
})
