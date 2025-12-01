# Stacks Mail Server

A self-hosted IMAP/SMTP mail server that uses AWS S3 as the backend storage.

## Features

- **IMAP Server** - Read emails from S3 via standard email clients
- **SMTP Server** - Send emails via SES
- **S3 Backend** - All emails stored in S3 bucket
- **User Authentication** - DynamoDB-based user credentials
- **TLS/SSL** - Secure connections

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Mail.app   │────▶│ IMAP Server │────▶│     S3      │
│  Outlook    │     │  (Port 993) │     │   Bucket    │
│  Thunderbird│     └─────────────┘     └─────────────┘
└─────────────┘            │
       │                   │
       │            ┌─────────────┐
       └───────────▶│ SMTP Server │────▶│    SES      │
                    │  (Port 465) │     └─────────────┘
                    └─────────────┘
                           │
                    ┌─────────────┐
                    │  DynamoDB   │
                    │   (Users)   │
                    └─────────────┘
```

## Mail.app Configuration

| Setting | Value |
|---------|-------|
| **Account Type** | IMAP |
| **Email** | <chris@stacksjs.com> |
| **Incoming Server** | mail.stacksjs.com |
| **Incoming Port** | 993 (SSL) |
| **Outgoing Server** | mail.stacksjs.com |
| **Outgoing Port** | 465 (SSL) |
| **Username** | <chris@stacksjs.com> |
| **Password** | (your password) |
