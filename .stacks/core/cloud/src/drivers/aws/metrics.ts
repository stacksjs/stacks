import process from 'node:process'
import { Metrics } from '@aws-lambda-powertools/metrics'

export const metrics = new Metrics({
  defaultDimensions: {
    aws_account_id: process.env.AWS_ACCOUNT_ID,
    aws_region: process.env.AWS_DEFAULT_REGION,
  },
})
