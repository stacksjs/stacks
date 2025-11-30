# Stacks Communication Services - Implementation Roadmap

A comprehensive plan for implementing serverless email, phone/voice, and SMS capabilities in Stacks, powered by ts-cloud.

**Goal:** Enable Stacks users to deploy fully-functional communication infrastructure with `./buddy deploy --yes`, including:

- Email inboxes for team members (e.g., <chris@stacksjs.org>)
- Phone numbers that can receive calls with notifications
- Programmatic SMS sending capabilities

---

## Current State Analysis

### What Already Exists in ts-cloud

**Email Module (`packages/core/src/modules/email.ts`):**

- ✅ `Email.verifyDomain()` - SES domain identity with DKIM
- ✅ `Email.createDkimRecords()` - Route53 DKIM CNAME records
- ✅ `Email.createConfigurationSet()` - SES configuration set
- ✅ `Email.createReceiptRuleSet()` - Inbound email rule set
- ✅ `Email.createReceiptRule()` - Receipt rules with S3/Lambda/SNS actions
- ✅ `Email.createMxRecord()` - MX record for inbound email
- ✅ `Email.createSpfRecord()` - SPF TXT record
- ✅ `Email.createDmarcRecord()` - DMARC TXT record
- ✅ `Email.createInboundEmailSetup()` - Complete inbound setup
- ✅ `Email.createCompleteDomainSetup()` - Full domain verification
- ✅ `Email.createEmailLambdaRole()` - IAM role for Lambda
- ✅ `Email.createOutboundEmailLambda()` - Outbound email Lambda
- ✅ `Email.createInboundEmailLambda()` - Inbound email Lambda
- ✅ `Email.createEmailConversionLambda()` - Email converter Lambda
- ✅ `Email.createEmailProcessingStack()` - Complete email stack
- ✅ `Email.LambdaCode.*` - Modern async/await Lambda code (AWS SDK v3)

**SES Client (`packages/ts-cloud/src/aws/ses.ts`):**

- ✅ `SESClient.createEmailIdentity()` - Create domain/email identity
- ✅ `SESClient.sendEmail()` - Send email via SES v2 API
- ✅ `SESClient.verifyDomain()` - Domain verification helper
- ✅ `SESClient.getDkimRecords()` - Get DKIM DNS records
- ❌ Missing: Receipt rule set/rule API methods (uses v1 API)

**AWS Types (`packages/aws-types/src/`):**

- ✅ `lambda.ts` - LambdaFunction, LambdaPermission types
- ✅ `sns.ts` - SNSTopic, SNSSubscription, SNSTopicPolicy types
- ✅ `ses.ts` - SESEmailIdentity, SESReceiptRuleSet, SESReceiptRule types
- ❌ Missing: Connect types, Pinpoint types

### What Already Exists in Stacks

**Email (`storage/framework/core/email/src/`):**

- ✅ `email.ts` - Email class with driver abstraction (SES, SendGrid, Mailgun)
- ✅ `drivers/ses.ts` - SES driver for sending
- ⚠️ `server/` - Legacy email server code (commented out)
- ❌ Missing: Inbound email SDK, email server deployment

**Deploy Command (`storage/framework/core/buddy/src/commands/deploy.ts`):**

- ✅ Basic CloudFormation stack creation via ts-cloud
- ✅ S3 bucket for assets
- ❌ **Missing: Email infrastructure deployment**
- ❌ **Missing: Phone infrastructure deployment**
- ❌ **Missing: SMS infrastructure deployment**

### Critical Gaps to Address

1. **Deploy command only creates basic S3 bucket** - needs to include email/phone/SMS resources
2. **No Lambda client in ts-cloud/src/aws/** - only CloudFormation types exist
3. **No SNS client in ts-cloud/src/aws/** - only CloudFormation types exist
4. **No SES receipt rule API methods** - needed for runtime operations
5. **No Amazon Connect types or client** - needed for phone features
6. **No Pinpoint/SMS types or client** - needed for SMS features

---

## Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Stacks Framework                                   │
│  config/email.ts  │  config/phone.ts  │  config/sms.ts  │  config/team.ts   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ts-cloud                                        │
│  Email Module  │  Phone Module (Connect)  │  SMS Module (Pinpoint/SNS)      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AWS Services                                       │
│  SES + S3 + Lambda  │  Amazon Connect  │  Pinpoint/SNS + End User Messaging │
└─────────────────────────────────────────────────────────────────────────────┘
```

### AWS Services Used

| Feature | Primary Service | Supporting Services |
|---------|-----------------|---------------------|
| Email Inboxes | Amazon SES | S3, Lambda, Route53, SNS |
| Phone/Voice | Amazon Connect | Lambda, SNS, DynamoDB |
| SMS Sending | AWS End User Messaging / Pinpoint | SNS, Lambda |

---

# PHASE 1: Serverless Email Server

## 1.1 Configuration Schema (Stacks)

### Tasks

- [ ] **1.1.1** Update `@stacksjs/types` with enhanced `EmailConfig` interface

  ```typescript
  interface EmailConfig {
    from: { name: string; address: string }
    mailboxes: string[] | MailboxConfig[]
    domain: string
    url: string
    charset: string
    server: {
      enabled: boolean
      scan: boolean // spam/virus scanning
      storage: {
        bucket?: string
        retentionDays?: number
        archiveAfterDays?: number
      }
      forwarding?: Record<string, string[]> // alias -> destinations
      autoResponders?: AutoResponderConfig[]
    }
    notifications: {
      newEmail?: boolean
      bounces?: boolean
      complaints?: boolean
    }
    default: 'ses' | 'smtp' | 'mailgun' | 'postmark'
  }
  ```

- [ ] **1.1.2** Create `MailboxConfig` type for advanced mailbox configuration

  ```typescript
  interface MailboxConfig {
    address: string
    displayName?: string
    forwardTo?: string[]
    autoResponder?: AutoResponderConfig
    filters?: EmailFilterRule[]
  }
  ```

- [ ] **1.1.3** Update `config/email.ts` with new schema and team integration
- [ ] **1.1.4** Add email server configuration validation in Stacks

## 1.2 ts-cloud AWS Clients

### Tasks

- [ ] **1.2.1** Create `/packages/ts-cloud/src/aws/lambda.ts` - Lambda client
  - `createFunction()` - Create Lambda function
  - `updateFunctionCode()` - Update function code
  - `invokeFunction()` - Invoke function
  - `addPermission()` - Add resource-based policy
  - `deleteFunction()` - Delete function
  - `listFunctions()` - List functions
  - `getFunction()` - Get function details
  - `publishVersion()` - Publish function version
  - `createAlias()` - Create function alias
  - Note: Types already exist in `@ts-cloud/aws-types/lambda`

- [ ] **1.2.2** Create `/packages/ts-cloud/src/aws/sns.ts` - SNS client
  - Note: Types already exist in `@ts-cloud/aws-types/sns`
  - `createTopic()` - Create SNS topic
  - `subscribe()` - Subscribe to topic
  - `publish()` - Publish message
  - `deleteTopic()` - Delete topic
  - `listTopics()` - List topics

- [ ] **1.2.3** Update `/packages/ts-cloud/src/aws/ses.ts` - Add receipt rule methods
  - `createReceiptRuleSet()` - Create rule set (uses SES v1 API)
  - `createReceiptRule()` - Create receipt rule
  - `setActiveReceiptRuleSet()` - Activate rule set
  - `deleteReceiptRule()` - Delete rule
  - `describeReceiptRuleSet()` - Get rule set details
  - `listReceiptRuleSets()` - List rule sets
  - Note: Receipt rules use SES v1 API, not v2

- [ ] **1.2.4** Update `/packages/ts-cloud/src/aws/index.ts` - Export new clients

## 1.3 Modernize Email Lambda Functions

**Note:** ts-cloud already has modern Lambda code in `Email.LambdaCode.*` using async/await and AWS SDK v3. The existing code handles:

- Inbound email organization by recipient/sender
- Outbound email with MIME generation
- Email conversion with attachment extraction

### Tasks (Enhancements to existing code)

- [ ] **1.3.1** Enhance inbound email handler (`Email.LambdaCode.inboundEmail`)
  - Location: `/packages/core/src/email/handlers/inbound.ts`
  - Features:
    - Parse raw MIME emails using modern libraries
    - Extract metadata (from, to, subject, date, attachments)
    - Organize by domain/account/sender structure
    - Support for + addressing (<user+tag@domain.com>)
    - Spam/virus scanning integration
    - Store in S3 with proper structure
    - Trigger SNS notifications
    - Support forwarding rules

- [ ] **1.3.2** Create modern outbound email handler
  - Location: `/packages/core/src/email/handlers/outbound.ts`
  - Features:
    - Accept JSON email payloads
    - Generate proper MIME messages
    - Support HTML and plain text
    - Handle attachments (base64 encoded)
    - Track via configuration set
    - Store sent emails in S3
    - Support templates

- [ ] **1.3.3** Create email conversion handler
  - Location: `/packages/core/src/email/handlers/converter.ts`
  - Features:
    - Convert raw MIME to HTML/text
    - Extract and save attachments separately
    - Generate email previews
    - Create searchable metadata JSON

- [ ] **1.3.4** Create bounce/complaint handler
  - Location: `/packages/core/src/email/handlers/feedback.ts`
  - Features:
    - Process SES bounce notifications
    - Process complaint notifications
    - Update suppression list
    - Send admin notifications

- [ ] **1.3.5** Bundle Lambda handlers for deployment
  - Create build script for Lambda packages
  - Include only necessary dependencies
  - Optimize for cold start performance

## 1.4 Email Module CloudFormation Resources

### Tasks

- [ ] **1.4.1** Update `Email.createCompleteDomainSetup()` to include:
  - SES domain identity with DKIM
  - DKIM DNS records (auto-created via Route53)
  - SPF record
  - DMARC record
  - MX record for inbound email
  - Configuration set with event destinations

- [ ] **1.4.2** Create `Email.createMailboxInfrastructure()` method
  - S3 bucket for email storage with lifecycle rules
  - Lambda functions (inbound, outbound, converter)
  - SES receipt rule set
  - SES receipt rules for each mailbox
  - SNS topics for notifications
  - IAM roles and policies
  - CloudWatch log groups

- [ ] **1.4.3** Create `Email.createTeamMailboxes()` method
  - Generate mailboxes from team config
  - Create individual receipt rules
  - Set up forwarding if configured
  - Create auto-responders if configured

- [ ] **1.4.4** Create `Email.createEmailNotifications()` method
  - SNS topic for new email notifications
  - SNS topic for bounce/complaint notifications
  - Lambda for processing notifications
  - Optional Slack/Discord webhook integration

## 1.5 Stacks Integration

### Tasks

- [ ] **1.5.1** Integrate email deployment into `./buddy deploy` command
  - Location: `/storage/framework/core/buddy/src/commands/deploy.ts`
  - Import ts-cloud Email module
  - Read `config/email.ts` for mailbox configuration
  - Read `config/team.ts` for team member emails
  - Call `Email.createCompleteDomainSetup()` for domain verification
  - Call `Email.createEmailProcessingStack()` for Lambda functions
  - Add email resources to CloudFormation template (currently only has S3 bucket)
  - Create S3 bucket for email storage with proper SES policy
  - Deploy receipt rules for each configured mailbox
  - Output: Domain verification status, mailbox addresses, S3 bucket name

- [ ] **1.5.2** Create email CLI commands in Stacks
  - `./buddy email:setup` - Initialize email infrastructure
  - `./buddy email:verify` - Check domain verification status
  - `./buddy email:test` - Send test email
  - `./buddy email:list` - List configured mailboxes
  - `./buddy email:logs` - View email processing logs

- [ ] **1.5.3** Create email SDK for Stacks applications
  - `Email.send()` - Send email programmatically
  - `Email.sendTemplate()` - Send templated email
  - `Email.getInbox()` - Retrieve inbox emails
  - `Email.search()` - Search emails
  - `Email.delete()` - Delete email

- [ ] **1.5.4** Create email webhook handlers
  - Webhook for new email notifications
  - Webhook for bounce/complaint handling
  - Integration with Stacks notification system

## 1.6 Testing & Documentation

### Tasks

- [ ] **1.6.1** Create unit tests for email handlers
- [ ] **1.6.2** Create integration tests for email flow
- [ ] **1.6.3** Create email configuration documentation
- [ ] **1.6.4** Create email API documentation
- [ ] **1.6.5** Create email troubleshooting guide

---

# PHASE 2: Phone/Voice Service (Amazon Connect)

## 2.1 Configuration Schema (Stacks)

### Tasks

- [ ] **2.1.1** Create `@stacksjs/types` `PhoneConfig` interface

  ```typescript
  interface PhoneConfig {
    enabled: boolean
    provider: 'connect' // Amazon Connect
    instance?: {
      alias: string
      inboundCallsEnabled: boolean
      outboundCallsEnabled: boolean
    }
    phoneNumbers: PhoneNumberConfig[]
    contactFlows: ContactFlowConfig[]
    notifications: {
      incomingCall?: NotificationConfig
      missedCall?: NotificationConfig
      voicemail?: NotificationConfig
    }
    voicemail: {
      enabled: boolean
      transcription: boolean
      maxDurationSeconds: number
      greeting?: string
    }
    businessHours?: BusinessHoursConfig
  }
  ```

- [ ] **2.1.2** Create `PhoneNumberConfig` type

  ```typescript
  interface PhoneNumberConfig {
    type: 'TOLL_FREE' | 'DID' | 'UIFN'
    countryCode: string
    description?: string
    contactFlowId?: string
    notifyOnCall?: string[] // team member emails/phones
  }
  ```

- [ ] **2.1.3** Create `config/phone.ts` in Stacks
- [ ] **2.1.4** Add phone configuration validation

## 2.2 ts-cloud AWS Clients

### Tasks

- [ ] **2.2.1** Create `/packages/ts-cloud/src/aws/connect.ts` - Amazon Connect client
  - `createInstance()` - Create Connect instance
  - `deleteInstance()` - Delete instance
  - `listInstances()` - List instances
  - `claimPhoneNumber()` - Claim phone number
  - `releasePhoneNumber()` - Release phone number
  - `listPhoneNumbers()` - List available numbers
  - `searchAvailablePhoneNumbers()` - Search for numbers
  - `createContactFlow()` - Create contact flow
  - `updateContactFlow()` - Update contact flow
  - `createQueue()` - Create queue
  - `createRoutingProfile()` - Create routing profile
  - `createUser()` - Create Connect user
  - `associatePhoneNumberContactFlow()` - Associate number with flow

- [ ] **2.2.2** Create `/packages/ts-cloud/src/aws/connect-contact-lens.ts` (optional)
  - Real-time analytics
  - Call transcription
  - Sentiment analysis

- [ ] **2.2.3** Update `/packages/ts-cloud/src/aws/index.ts` - Export Connect client

## 2.3 Phone Module CloudFormation Resources

### Tasks

- [ ] **2.3.1** Create `Phone` class in `/packages/core/src/modules/phone.ts`
  - `createConnectInstance()` - CloudFormation for Connect instance
  - `createPhoneNumber()` - CloudFormation for phone number
  - `createContactFlow()` - CloudFormation for contact flow
  - `createQueue()` - CloudFormation for queue
  - `createRoutingProfile()` - CloudFormation for routing profile
  - `createHoursOfOperation()` - CloudFormation for business hours

- [ ] **2.3.2** Create contact flow templates
  - Basic IVR flow
  - Voicemail flow
  - Business hours routing flow
  - Call forwarding flow
  - Notification flow (calls Lambda to notify)

- [ ] **2.3.3** Create Lambda handlers for phone events
  - `/packages/core/src/phone/handlers/incoming-call.ts`
    - Log call details
    - Send notifications (SNS, webhook)
    - Route based on caller ID
  - `/packages/core/src/phone/handlers/voicemail.ts`
    - Process voicemail recordings
    - Transcribe using Amazon Transcribe
    - Send notification with transcription
  - `/packages/core/src/phone/handlers/missed-call.ts`
    - Log missed call
    - Send notification

- [ ] **2.3.4** Create `Phone.createCompleteSetup()` method
  - Connect instance
  - Phone number(s)
  - Contact flows
  - Queues and routing
  - Lambda integrations
  - SNS topics for notifications
  - S3 bucket for recordings
  - IAM roles

## 2.4 Stacks Integration

### Tasks

- [ ] **2.4.1** Create phone deployment in `./buddy deploy`
  - Detect phone configuration
  - Generate CloudFormation resources
  - Deploy Connect infrastructure
  - Output phone numbers and access URLs

- [ ] **2.4.2** Create phone CLI commands
  - `./buddy phone:setup` - Initialize phone infrastructure
  - `./buddy phone:numbers` - List phone numbers
  - `./buddy phone:claim` - Claim new phone number
  - `./buddy phone:release` - Release phone number
  - `./buddy phone:logs` - View call logs
  - `./buddy phone:voicemails` - List voicemails

- [ ] **2.4.3** Create phone SDK for Stacks applications
  - `Phone.makeCall()` - Initiate outbound call
  - `Phone.getCallHistory()` - Get call history
  - `Phone.getVoicemails()` - Get voicemails
  - `Phone.getRecording()` - Get call recording

- [ ] **2.4.4** Create phone notification handlers
  - Webhook for incoming calls
  - Webhook for missed calls
  - Webhook for voicemails
  - Integration with Stacks notification system

## 2.5 Testing & Documentation

### Tasks

- [ ] **2.5.1** Create unit tests for phone handlers
- [ ] **2.5.2** Create integration tests for phone flow
- [ ] **2.5.3** Create phone configuration documentation
- [ ] **2.5.4** Create phone API documentation
- [ ] **2.5.5** Create Amazon Connect setup guide

---

# PHASE 3: SMS Service

## 3.1 Configuration Schema (Stacks)

### Tasks

- [ ] **3.1.1** Create `@stacksjs/types` `SmsConfig` interface

  ```typescript
  interface SmsConfig {
    enabled: boolean
    provider: 'pinpoint' | 'sns' | 'end-user-messaging'
    senderId?: string // Sender ID (where supported)
    originationNumber?: string // Phone number to send from
    defaultCountryCode: string
    messageType: 'TRANSACTIONAL' | 'PROMOTIONAL'
    maxSpendPerMonth?: number // Budget limit
    optOut: {
      enabled: boolean
      keywords: string[] // STOP, UNSUBSCRIBE, etc.
    }
    templates?: SmsTemplateConfig[]
    twoWay?: {
      enabled: boolean
      webhookUrl?: string
      snsTopicArn?: string
    }
  }
  ```

- [ ] **3.1.2** Create `SmsTemplateConfig` type

  ```typescript
  interface SmsTemplateConfig {
    name: string
    body: string
    variables?: string[]
  }
  ```

- [ ] **3.1.3** Create `config/sms.ts` in Stacks
- [ ] **3.1.4** Add SMS configuration validation

## 3.2 ts-cloud AWS Clients

### Tasks

- [ ] **3.2.1** Create `/packages/ts-cloud/src/aws/pinpoint.ts` - Pinpoint client
  - `createApp()` - Create Pinpoint application
  - `deleteApp()` - Delete application
  - `updateSmsChannel()` - Configure SMS channel
  - `sendMessages()` - Send SMS messages
  - `createSegment()` - Create user segment
  - `createCampaign()` - Create SMS campaign
  - `getPhoneNumberInfo()` - Validate phone number

- [ ] **3.2.2** Create `/packages/ts-cloud/src/aws/pinpoint-sms-voice.ts` - SMS Voice V2
  - `requestPhoneNumber()` - Request origination number
  - `releasePhoneNumber()` - Release number
  - `sendTextMessage()` - Send SMS
  - `createPool()` - Create number pool
  - `createOptOutList()` - Create opt-out list
  - `putOptedOutNumber()` - Add to opt-out list
  - `deleteOptedOutNumber()` - Remove from opt-out

- [ ] **3.2.3** Alternative: Create `/packages/ts-cloud/src/aws/end-user-messaging.ts`
  - AWS End User Messaging SMS API
  - More modern API for SMS

- [ ] **3.2.4** Update `/packages/ts-cloud/src/aws/index.ts` - Export SMS clients

## 3.3 SMS Module CloudFormation Resources

### Tasks

- [ ] **3.3.1** Create `SMS` class in `/packages/core/src/modules/sms.ts`
  - `createPinpointApp()` - CloudFormation for Pinpoint app
  - `configureSmsChannel()` - CloudFormation for SMS channel
  - `createOriginationNumber()` - Request phone number
  - `createOptOutList()` - CloudFormation for opt-out list
  - `createSmsTemplate()` - CloudFormation for templates

- [ ] **3.3.2** Create Lambda handlers for SMS events
  - `/packages/core/src/sms/handlers/send.ts`
    - Send SMS via Pinpoint/SNS
    - Handle templated messages
    - Track delivery status
  - `/packages/core/src/sms/handlers/receive.ts`
    - Process inbound SMS (two-way)
    - Handle opt-out keywords
    - Forward to webhook
  - `/packages/core/src/sms/handlers/delivery-status.ts`
    - Process delivery receipts
    - Update message status
    - Handle failures

- [ ] **3.3.3** Create `SMS.createCompleteSetup()` method
  - Pinpoint application
  - SMS channel configuration
  - Origination number (if needed)
  - Opt-out list
  - SNS topics for delivery status
  - Lambda for two-way SMS
  - IAM roles
  - CloudWatch alarms for spend

## 3.4 Stacks Integration

### Tasks

- [ ] **3.4.1** Create SMS deployment in `./buddy deploy`
  - Detect SMS configuration
  - Generate CloudFormation resources
  - Deploy Pinpoint infrastructure
  - Output sender ID/number

- [ ] **3.4.2** Create SMS CLI commands
  - `./buddy sms:setup` - Initialize SMS infrastructure
  - `./buddy sms:send` - Send test SMS
  - `./buddy sms:status` - Check SMS channel status
  - `./buddy sms:logs` - View SMS logs
  - `./buddy sms:optouts` - Manage opt-out list

- [ ] **3.4.3** Create SMS SDK for Stacks applications
  - `SMS.send()` - Send SMS
  - `SMS.sendTemplate()` - Send templated SMS
  - `SMS.sendBulk()` - Send bulk SMS
  - `SMS.getDeliveryStatus()` - Check delivery status
  - `SMS.addOptOut()` - Add to opt-out list
  - `SMS.removeOptOut()` - Remove from opt-out

- [ ] **3.4.4** Create SMS notification handlers
  - Webhook for inbound SMS
  - Webhook for delivery status
  - Integration with Stacks notification system

## 3.5 Testing & Documentation

### Tasks

- [ ] **3.5.1** Create unit tests for SMS handlers
- [ ] **3.5.2** Create integration tests for SMS flow
- [ ] **3.5.3** Create SMS configuration documentation
- [ ] **3.5.4** Create SMS API documentation
- [ ] **3.5.5** Create SMS compliance guide (opt-out, regulations)

---

# PHASE 4: Unified Communication Module

## 4.1 Unified Configuration

### Tasks

- [ ] **4.1.1** Create unified `CommunicationConfig` type

  ```typescript
  interface CommunicationConfig {
    email: EmailConfig
    phone: PhoneConfig
    sms: SmsConfig
    notifications: UnifiedNotificationConfig
  }
  ```

- [ ] **4.1.2** Create `config/communication.ts` or keep separate configs
- [ ] **4.1.3** Add cross-service validation (e.g., phone number for SMS)

## 4.2 Unified Deployment

### Tasks

- [ ] **4.2.1** Update `./buddy deploy` to handle all communication services
  - Deploy email infrastructure
  - Deploy phone infrastructure
  - Deploy SMS infrastructure
  - Create shared resources (IAM, S3, SNS)

- [ ] **4.2.2** Create deployment order and dependencies
  - Email first (domain verification needed)
  - Phone second (Connect instance setup)
  - SMS third (may use phone number from Connect)

- [ ] **4.2.3** Create rollback handling for partial failures

## 4.3 Unified SDK

### Tasks

- [ ] **4.3.1** Create unified communication SDK

  ```typescript
  import { Communication } from '@stacksjs/communication'

  // Send via best channel
  await Communication.notify(user, {
    message: 'Your order shipped!',
    channels: ['email', 'sms'],
    priority: 'high'
  })

  // Access individual services
  await Communication.email.send(...)
  await Communication.sms.send(...)
  await Communication.phone.call(...)
  ```

- [ ] **4.3.2** Create notification preferences system
  - User channel preferences
  - Fallback channels
  - Quiet hours

## 4.4 Monitoring & Analytics

### Tasks

- [ ] **4.4.1** Create unified communication dashboard
  - Email metrics (sent, delivered, bounced, opened)
  - Phone metrics (calls, duration, missed)
  - SMS metrics (sent, delivered, failed)

- [ ] **4.4.2** Create CloudWatch alarms
  - Email bounce rate
  - SMS delivery failure rate
  - Phone missed call rate
  - Cost thresholds

- [ ] **4.4.3** Create cost tracking
  - Per-service costs
  - Per-team-member costs
  - Budget alerts

---

# PHASE 5: Advanced Features

## 5.1 Email Advanced Features

### Tasks

- [ ] **5.1.1** Email search and indexing (OpenSearch integration)
- [ ] **5.1.2** Email threading and conversation view
- [ ] **5.1.3** Email scheduling (send later)
- [ ] **5.1.4** Email analytics (open tracking, click tracking)
- [ ] **5.1.5** Email templates with Stacks views
- [ ] **5.1.6** Shared mailboxes for teams
- [ ] **5.1.7** Email rules and automation

## 5.2 Phone Advanced Features

### Tasks

- [ ] **5.2.1** Call recording with transcription
- [ ] **5.2.2** IVR builder (visual contact flow editor)
- [ ] **5.2.3** Call analytics and reporting
- [ ] **5.2.4** Conference calling
- [ ] **5.2.5** Call queuing with estimated wait time
- [ ] **5.2.6** Callback requests
- [ ] **5.2.7** Integration with CRM/helpdesk

## 5.3 SMS Advanced Features

### Tasks

- [ ] **5.3.1** SMS campaigns and scheduling
- [ ] **5.3.2** SMS analytics (delivery rates, engagement)
- [ ] **5.3.3** MMS support (images, media)
- [ ] **5.3.4** SMS chatbot integration
- [ ] **5.3.5** Link shortening and tracking
- [ ] **5.3.6** A/B testing for SMS content

---

# Implementation Priority

## Sprint 1: Email Foundation (Weeks 1-2)

**Critical Path - The key integration point is deploy.ts:**

1. **1.2.1** Create Lambda client (`/packages/ts-cloud/src/aws/lambda.ts`)
2. **1.2.2** Create SNS client (`/packages/ts-cloud/src/aws/sns.ts`)
3. **1.2.3** Add receipt rule methods to SES client (v1 API)
4. **1.5.1** **KEY TASK:** Update `deploy.ts` to use ts-cloud Email module
   - Currently only creates basic S3 bucket
   - Need to import `Email` from ts-cloud core
   - Call `Email.createEmailProcessingStack()` to generate resources
   - Merge email resources into CloudFormation template

## Sprint 2: Email Complete (Weeks 3-4)

1. **1.1.1 - 1.1.4** Update email configuration schema in Stacks
2. **1.3.1 - 1.3.4** Enhance Lambda handlers (already exist in ts-cloud)
3. **1.4.1 - 1.4.4** Verify Email module CloudFormation generation
4. **1.5.2 - 1.5.4** Create email CLI commands and SDK

## Sprint 3: SMS Foundation (Weeks 5-6)

1. Create SMS configuration schema (3.1.1 - 3.1.4)
2. Create Pinpoint client (3.2.1 - 3.2.2)
3. Create SMS module (3.3.1 - 3.3.3)
4. Integrate with Stacks deploy (3.4.1)

## Sprint 4: SMS Complete (Weeks 7-8)

1. Create SMS CLI commands (3.4.2)
2. Create SMS SDK (3.4.3)
3. Create SMS handlers (3.4.4)
4. Testing and documentation (3.5.1 - 3.5.5)

## Sprint 5: Phone Foundation (Weeks 9-10)

1. Create phone configuration schema (2.1.1 - 2.1.4)
2. Create Connect client (2.2.1)
3. Create Phone module (2.3.1 - 2.3.2)
4. Create contact flow templates (2.3.2)

## Sprint 6: Phone Complete (Weeks 11-12)

1. Create phone Lambda handlers (2.3.3)
2. Create complete setup method (2.3.4)
3. Integrate with Stacks deploy (2.4.1)
4. Create phone CLI and SDK (2.4.2 - 2.4.4)

## Sprint 7: Unified & Polish (Weeks 13-14)

1. Create unified configuration (4.1.1 - 4.1.3)
2. Create unified deployment (4.2.1 - 4.2.3)
3. Create unified SDK (4.3.1 - 4.3.2)
4. Create monitoring dashboard (4.4.1 - 4.4.3)

---

# File Structure

## ts-cloud Changes

```
packages/ts-cloud/src/aws/
├── lambda.ts           # NEW - Lambda client
├── sns.ts              # NEW - SNS client
├── connect.ts          # NEW - Amazon Connect client
├── pinpoint.ts         # NEW - Pinpoint client
├── pinpoint-sms-voice.ts # NEW - SMS Voice V2 client
├── ses.ts              # UPDATE - Add receipt rule methods
└── index.ts            # UPDATE - Export new clients

packages/core/src/
├── modules/
│   ├── email.ts        # UPDATE - Enhanced email module
│   ├── phone.ts        # NEW - Phone/Connect module
│   └── sms.ts          # NEW - SMS module
├── email/
│   └── handlers/
│       ├── inbound.ts      # NEW - Inbound email Lambda
│       ├── outbound.ts     # NEW - Outbound email Lambda
│       ├── converter.ts    # NEW - Email converter Lambda
│       └── feedback.ts     # NEW - Bounce/complaint Lambda
├── phone/
│   └── handlers/
│       ├── incoming-call.ts  # NEW - Incoming call Lambda
│       ├── voicemail.ts      # NEW - Voicemail Lambda
│       └── missed-call.ts    # NEW - Missed call Lambda
└── sms/
    └── handlers/
        ├── send.ts           # NEW - Send SMS Lambda
        ├── receive.ts        # NEW - Receive SMS Lambda
        └── delivery-status.ts # NEW - Delivery status Lambda
```

## Stacks Changes

```text
config/
├── email.ts            # UPDATE - Enhanced email config
├── phone.ts            # NEW - Phone configuration
├── sms.ts              # NEW - SMS configuration
└── team.ts             # UPDATE - Add communication preferences

storage/framework/core/
├── email/
│   └── src/
│       ├── server/     # DEPRECATED - Move to ts-cloud
│       └── sdk/        # NEW - Email SDK for apps
├── phone/              # NEW - Phone SDK
│   └── src/
│       └── sdk/
└── sms/                # NEW - SMS SDK
    └── src/
        └── sdk/

app/Commands/
├── EmailCommand.ts     # NEW - Email CLI commands
├── PhoneCommand.ts     # NEW - Phone CLI commands
└── SmsCommand.ts       # NEW - SMS CLI commands
```

---

# Cost Estimates

## Email (SES)

- Sending: $0.10 per 1,000 emails
- Receiving: $0.10 per 1,000 emails
- S3 Storage: ~$0.023 per GB/month
- Lambda: Minimal (free tier usually covers)

## Phone (Amazon Connect)

- Instance: Free
- Phone Number: $0.03-$2.00/day depending on type
- Inbound Calls: $0.0022-$0.018/minute
- Outbound Calls: $0.0022-$0.018/minute
- Recording Storage: $0.0025/minute

## SMS (Pinpoint/SNS)

- Outbound SMS: $0.00645-$0.0875 per message (varies by country)
- Inbound SMS: $0.0075 per message
- Phone Number: $1.00-$200/month depending on type
- Long Code: ~$1/month
- Toll-Free: ~$2/month
- Short Code: ~$1,000/month

## Estimated Monthly Cost for Small Team (10 users)

- Email: ~$5-10/month
- Phone: ~$50-100/month (with moderate usage)
- SMS: ~$20-50/month (with moderate usage)
- **Total: ~$75-160/month**

---

# Security Considerations

## Email

- [ ] Enable SES sending authorization
- [ ] Implement DKIM, SPF, DMARC
- [ ] Encrypt emails at rest (S3 SSE)
- [ ] Encrypt emails in transit (TLS)
- [ ] Implement email retention policies
- [ ] Set up bounce/complaint handling

## Phone

- [ ] Enable call recording encryption
- [ ] Implement access controls for recordings
- [ ] Set up audit logging
- [ ] Configure data retention policies
- [ ] Implement caller ID verification

## SMS

- [ ] Implement opt-out handling
- [ ] Set spending limits
- [ ] Enable delivery status tracking
- [ ] Implement rate limiting
- [ ] Follow carrier compliance requirements

---

# Compliance Notes

## Email

- CAN-SPAM Act compliance (unsubscribe, physical address)
- GDPR compliance (consent, data retention)
- CASL compliance (Canadian Anti-Spam Legislation)

## Phone

- TCPA compliance (Telephone Consumer Protection Act)
- Call recording consent requirements (varies by state/country)
- Do Not Call registry compliance

## SMS

- TCPA compliance
- CTIA guidelines
- Carrier-specific requirements
- 10DLC registration (for US A2P messaging)
- Opt-out handling requirements

---

# Success Metrics

## Email

- [ ] Team members can send/receive emails at @stacksjs.org
- [ ] Emails are properly organized in S3
- [ ] Bounce rate < 2%
- [ ] Complaint rate < 0.1%

## Phone

- [ ] Phone number is claimable and callable
- [ ] Incoming calls trigger notifications
- [ ] Voicemails are transcribed and delivered
- [ ] Call quality meets expectations

## SMS

- [ ] SMS can be sent programmatically
- [ ] Delivery rate > 95%
- [ ] Opt-out handling works correctly
- [ ] Two-way SMS functions properly

---

# Quick Start: Minimum Viable Email Server

To get email working with `./buddy deploy --yes`, here's the minimum implementation:

## Step 1: Create AWS Clients in ts-cloud (4-6 hours)

```typescript
// File: /packages/ts-cloud/src/aws/lambda.ts
import { AWSClient } from './client'

export class LambdaClient {
  private client: AWSClient
  private region: string

  constructor(region: string = 'us-east-1') {
    this.region = region
    this.client = new AWSClient()
  }

  async createFunction(params: {
    FunctionName: string
    Runtime: string
    Role: string
    Handler: string
    Code: { ZipFile?: string; S3Bucket?: string; S3Key?: string }
    Timeout?: number
    MemorySize?: number
    Environment?: { Variables: Record<string, string> }
  }): Promise<{ FunctionArn: string }> {
    // Implementation using AWS Lambda API
  }

  async invokeFunction(params: {
    FunctionName: string
    Payload?: string
  }): Promise<{ StatusCode: number; Payload?: string }> {
    // Implementation
  }
}
```

## Step 2: Add Receipt Rule Methods to SES Client (2-3 hours)

```typescript
// File: /packages/ts-cloud/src/aws/ses.ts - Add to existing SESClient class

// Note: Receipt rules use SES v1 API (not v2)
async createReceiptRuleSet(ruleSetName: string): Promise<void> {
  await this.client.request({
    service: 'ses',
    region: this.region,
    method: 'POST',
    path: '/',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `Action=CreateReceiptRuleSet&RuleSetName=${ruleSetName}&Version=2010-12-01`,
  })
}

async setActiveReceiptRuleSet(ruleSetName: string): Promise<void> {
  await this.client.request({
    service: 'ses',
    region: this.region,
    method: 'POST',
    path: '/',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `Action=SetActiveReceiptRuleSet&RuleSetName=${ruleSetName}&Version=2010-12-01`,
  })
}
```

## Step 3: Update deploy.ts (3-4 hours) - THE KEY INTEGRATION

```typescript
// File: /storage/framework/core/buddy/src/commands/deploy.ts
// Add after line ~505 where template.Resources is defined

import { Email } from 'ts-cloud/core'

// Read email config
const emailConfig = await import('../../../../../config/email')
const teamConfig = await import('../../../../../config/team')

// Generate email infrastructure
const domain = emailConfig.default.from.address.split('@')[1] // e.g., 'stacksjs.org'
const emailStack = Email.createEmailProcessingStack({
  slug: appName,
  environment: 'production',
  domain: domain,
  s3BucketName: `${appName}-emails`,
  s3BucketArn: `arn:aws:s3:::${appName}-emails`,
})

// Merge email resources into template
Object.assign(template.Resources, emailStack.resources)

// Add email bucket
template.Resources.EmailBucket = {
  Type: 'AWS::S3::Bucket',
  Properties: {
    BucketName: `${appName}-emails`,
    // ... bucket config
  }
}

// Add domain verification
const domainSetup = Email.createCompleteDomainSetup({
  slug: appName,
  environment: 'production',
  domain: domain,
  hostedZoneId: process.env.ROUTE53_HOSTED_ZONE_ID,
  region: process.env.AWS_REGION || 'us-east-1',
  enableInbound: true,
  inboundS3Bucket: `${appName}-emails`,
})

Object.assign(template.Resources, domainSetup.resources)
```

## Step 4: Test Deployment

```bash
# Set required environment variables
export ROUTE53_HOSTED_ZONE_ID=Z01455702Q7952O6RCY37

# Deploy
./buddy deploy --yes
```

## What Gets Deployed

After running `./buddy deploy --yes`:

1. **SES Domain Identity** - stacksjs.org verified for sending/receiving
2. **DKIM Records** - 3 CNAME records in Route53
3. **SPF Record** - TXT record for email authentication
4. **DMARC Record** - TXT record for email policy
5. **MX Record** - Points to SES inbound SMTP
6. **S3 Bucket** - Stores incoming emails
7. **Lambda Functions** - Process inbound/outbound emails
8. **SES Receipt Rules** - Route emails to S3 and Lambda
9. **IAM Roles** - Permissions for Lambda to access S3/SES

## Verification

```bash
# Check domain verification status
./buddy email:verify

# Send test email
./buddy email:test chris@stacksjs.org

# View email logs
./buddy email:logs
```
