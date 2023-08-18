import process from 'node:process'
import { Logger } from '@aws-lambda-powertools/logger'

export const logger = new Logger({
  persistentLogAttributes: {
    aws_account_id: process.env.AWS_ACCOUNT_ID,
    aws_region: process.env.AWS_DEFAULT_REGION,
  },
})
