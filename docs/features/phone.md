# Phone/Voice Service

Stacks provides phone/voice capabilities powered by Amazon Connect.

## Configuration

Configure your phone settings in `config/phone.ts`:

```typescript
export default {
  enabled: true,

  provider: 'connect',

  instance: {
    alias: 'my-app-phone',
    inboundCallsEnabled: true,
    outboundCallsEnabled: true,
  },

  notifications: {
    incomingCall: {
      enabled: true,
      channels: ['email', 'sms'],
    },
    missedCall: {
      enabled: true,
      channels: ['email'],
    },
    voicemail: {
      enabled: true,
      channels: ['email'],
    },
  },

  voicemail: {
    enabled: true,
    transcription: true,
    maxDurationSeconds: 120,
    greeting: 'Please leave a message after the tone.',
  },

  businessHours: {
    timezone: 'America/Los_Angeles',
    schedule: [
      { day: 'MONDAY', start: '09:00', end: '17:00' },
      { day: 'TUESDAY', start: '09:00', end: '17:00' },
      { day: 'WEDNESDAY', start: '09:00', end: '17:00' },
      { day: 'THURSDAY', start: '09:00', end: '17:00' },
      { day: 'FRIDAY', start: '09:00', end: '17:00' },
    ],
  },
}
```

## Deployment

Deploy your phone infrastructure with:

```bash
./buddy deploy
```

This creates:

- Amazon Connect instance
- Lambda functions for call handling
- DynamoDB table for call logs
- S3 bucket for voicemails
- SNS topics for notifications

## CLI Commands

```bash
# Check phone service status
./buddy phone:status

# List phone numbers
./buddy phone:numbers

# Search available phone numbers
./buddy phone:search US --type TOLL_FREE

# Initialize phone infrastructure
./buddy phone:setup
```

## Amazon Connect Setup

After deployment, complete setup in the AWS Console:

1. **Access Connect Console**
   - Go to Amazon Connect in AWS Console
   - Select your instance

2. **Claim Phone Number**
   - Go to Phone Numbers
   - Claim a toll-free or DID number

3. **Configure Contact Flow**
   - Create or modify contact flows
   - Associate with phone number

4. **Set Up Users**
   - Create agent users
   - Assign routing profiles

## Architecture

```
Incoming Call Flow:
┌────────┐    ┌─────────┐    ┌──────────────┐    ┌────────┐
│ Caller │───▶│ Connect │───▶│ Contact Flow │───▶│ Lambda │
└────────┘    └─────────┘    └──────────────┘    └────────┘
                                                      │
                    ┌─────────────────────────────────┤
                    ▼                                 ▼
              ┌──────────┐                      ┌─────────┐
              │ DynamoDB │                      │   SNS   │
              └──────────┘                      └─────────┘

Voicemail Flow:
┌────────┐    ┌─────────┐    ┌────────┐    ┌────────────┐
│ Caller │───▶│ Connect │───▶│   S3   │───▶│ Transcribe │
└────────┘    └─────────┘    └────────┘    └────────────┘
                                                  │
                                                  ▼
                                            ┌─────────┐
                                            │   SNS   │
                                            └─────────┘
```

## Lambda Handlers

### Incoming Call Handler

Processes incoming calls:

- Logs call details to DynamoDB
- Sends SNS notifications
- Forwards to webhook if configured

### Voicemail Handler

Processes voicemail recordings:

- Stores in S3
- Transcribes using Amazon Transcribe
- Sends notification with transcription

### Missed Call Handler

Handles abandoned/missed calls:

- Updates call log
- Sends missed call notifications

## Troubleshooting

### Connect Instance Not Found

1. Verify instance alias in config
2. Check AWS region matches
3. Run `./buddy phone:status`

### Calls Not Routing

1. Check contact flow configuration
2. Verify phone number is associated
3. Check Lambda permissions

### Voicemail Not Working

1. Verify S3 bucket permissions
2. Check Transcribe service access
3. Review Lambda logs

## Cost Considerations

| Resource | Cost |
|----------|------|
| Connect Instance | Free |
| Phone Number | $0.03-$2.00/day |
| Inbound Calls | $0.0022-$0.018/min |
| Outbound Calls | $0.0022-$0.018/min |
| Recording Storage | $0.0025/min |
| Transcription | $0.024/min |
