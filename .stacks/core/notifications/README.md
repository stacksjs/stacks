# Stacks Notifications

wip

## ☘️ Features

wip

- ⚡️

wip

## 🤖 Usage

wip

```bash
pnpm i -D @stacksjs/notifications
```

Now, you can use it in your project:

```js
import notifications from '@stacksjs/notifications'

// wip
```

## 🤖 Drivers

- To use the drivers, import notifications and the driver name. E.g Sendgrid

 ```js
import notifications from '@stacksjs/notifications'

const notification = notifications.sendgrid

notification.send(Options)
 ```

There are several types of Options for Chat, Email, and SMS drivers.

```js
ChatOptions = {
  webhookUrl: string;
  content: string;
}

EmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  text?: string;
  attachments?: IAttachmentOptions[];
  id?: string;
}

SMSOptions = {
  to: string;
  content: string;
  from?: string;
  attachments?: IAttachmentOptions[];
  id?: string;
}
```

Available easy-to-user drivers are listed below, with the variables needed to be set!

### Email

- Sendgrid

    ```
    SENDGRID_API_KEY=SG123
    SENDGRID_FROM=from@example.com
    SENDGRID_SENDER_NAME=Sender
    ```

- Mailgun

    ```
    MAILGUN_API_KEY=MG123
    MAILGUN_DOMAIN=example.com
    MAILGUN_USERNAME=username
    MAILGUN_FROM=from@example.com
    ```

- Mailjet

    ```
    MAILJET_API_KEY=MJ123
    MAILJET_API_SECRET=MJTESTSECRET
    MAILJET_FROM_EMAIL=from@example.com
    ```

- Netcore

    ```
    NETCORE_API_KEY=NC123
    NETCORE_FROM=from@example.com
    ```

- Nodemailer

    ```
    NODEMAILER_FROM_EMAIL=from@example.com
    NODEMAILER_HOST=example.com
    NODEMAILER_USERNAME=username
    NODEMAILER_PASSWORD=password
    NODEMAILER_PORT=25
    NODEMAILER_SECURE=true
    ```

- Post Mark

    ```
    POSTMARK_API_KEY=PM123
    POSTMARK_FROM=from@example.com
    ```

- Ses

    ```
    SES_REGION=US
    SES_ACCESS_KEY_ID=testkey123
    SES_SECRET_ACCESS_KEY=testaccesskey123
    SES_FROM=from@example.com
    ```

- Mandrill

    ```
    MANDRILL_API_KEY=Ma123
    MANDRILL_EMAIL=from@example.com
    ```

- EmailJS

    ```
    EMAILJS_FROM_EMAIL=from@example.com
    EMAILJS_HOST=example.com
    EMAILJS_USERNAME=username
    EMAILJS_PASSWORD=password
    EMAILJS_PORT=25
    EMAILJS_SECURE=true
    ```

### SMS

- Twilio

    ```
    TWILIO_ACCOUNT_SID=ACtest
    TWILIO_AUTH_TOKEN=testtoken
    TWILIO_FROM_NUMBER=+112345
    TWILIO_TO_NUMBER=+145678
    ```

- Nexmo

    ```
    VONAGE_API_KEY=VN123
    VONAGE_API_SECRET=testkey
    VONAGE_FROM_NUMBER=+112345
    ```

- Gupshup

    ```
    GUPSHUP_USER_ID=GU123
    GUPSHUP_PASSWORD=password
    ```

- Plivo

    ```
    PLIVO_ACCOUNT_ID=PA123
    PLIVO_AUTH_TOKEN=testtoken
    PLIVO_FROM_NUMBER=+112345
    ```

- SMS77

    ```
    SMS77_API_KEY=SA123
    SMS77_FROM=from@example.com
    ```

- SNS

    ```
    SMS77_API_KEY=SA123
    SMS77_FROM=from@example.com
    ```

- Telnyx

    ```
    TELNYX_API_KEY=TA123
    TELNYX_MESSAGE_PROFILE_ID=testprofileid
    TELNYX_FROM=from@example.com
    ```

- Termii

    ```
    TERMII_API_KEY=TermA123
    TERMII_SENDER=from@example.com
    ```

### Chat

- Discord
  - None
  
- Slack

    ```
    SLACK_APPLICATION_ID=SAID123
    SLACK_CLIENT_ID=SCID123
    SLACK_SECRET_KEY=SSK123
    ```

Learn more in the docs.

## 🧪 Testing

```bash
pnpm test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 💪🏼 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.ow3.org)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with ❤️
