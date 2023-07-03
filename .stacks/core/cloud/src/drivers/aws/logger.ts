import { Logger } from '@aws-lambda-powertools/logger'

export const logger = new Logger({
  persistentLogAttributes: {
    aws_account_id: process.env.AWS_ACCOUNT_ID || 'N/A',
    aws_region: process.env.AWS_REGION || 'N/A',
  },
})
