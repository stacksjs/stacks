---
title: "Messaging skills"
description: "Email, SMS, push, chat, notifications and calendars."
---
# Messaging

Email, SMS, push, chat, notifications and calendars.

Everything that leaves the app and reaches a person. Each of these is
driver-based, so the skill covers both the sending surface and the drivers
behind it.

7 skills.

| Skill | What it is for |
|---|---|
| [Calendar](/skills/messaging/calendar) | Calendar links for Google, Outlook, Yahoo and ICS, including timezone handling and all-day events. |
| [Chat](/skills/messaging/chat) | Messages into Slack, Discord and Microsoft Teams, through webhooks or bot tokens, behind a shared driver abstraction with retry logic and multi-channel routing. |
| [Email](/skills/messaging/email) | The email framework: SES, SendGrid, Mailgun, Mailtrap and SMTP drivers, the `Mail` singleton, stx email templates, inbox management and inbound MIME parsing. |
| [Mail](/skills/messaging/mail) | Writing the mail classes in `app/Mail/`: the content, the stx or HTML template, and variable interpolation. |
| [Notifications](/skills/messaging/notifications) | One notification, many channels: email, SMS, push, chat and database. |
| [Push](/skills/messaging/push) | Push notifications through Expo or Firebase Cloud Messaging: payloads, batch and multicast sending, topic subscriptions, token validation and receipt checking. |
| [SMS](/skills/messaging/sms) | Text messages through Twilio or Vonage: the fluent builder, templates, phone verification with one-time codes, bulk sending and E.164 formatting. |

Every page here describes one `SKILL.md` under
[`storage/framework/defaults/ai/skills`](https://github.com/stacksjs/stacks/tree/main/storage/framework/defaults/ai/skills).
See [Using skills](/skills/using) to wire them into your agent.
