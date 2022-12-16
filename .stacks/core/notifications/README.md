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

    notification.send({})
 ```

Available drivers are listed below:

### Email

- Sendgrid
  - Variables

    ```
    SENDGRID_API_KEY=SG123
    SENDGRID_FROM=from@example.com
    SENDGRID_SENDER_NAME=Sender
    ```

- Mailgun
  - Variables

    ```
    MAILGUN_API_KEY=MG123
    MAILGUN_DOMAIN=example.com
    MAILGUN_USERNAME=usernamexample
    MAILGUN_FROM=from@example.com
    ```

- Mailjet
  - Variables

    ```
    MAILJET_API_KEY=MJ123
    MAILJET_API_SECRET=MJTESTSECRET
    MAILJET_FROM_EMAIL=from@example.com
    ```

- Netcore
  - Variables

    ```
    NETCORE_API_KEY=NC123
    NETCORE_FROM=from@example.com
    ```

- Nodemailer
  - Variables

    ```
    NODEMAILER_FROM_EMAIL=from@example.com
    NODEMAILER_HOST=example.com
    NODEMAILER_USERNAME=username
    NODEMAILER_PASSWORD=password
    NODEMAILER_PORT=25
    NODEMAILER_SECURE=true
    ```

- Post Mark
- Ses
- Mandrill
- EmailJS

### SMS

- Twilio
- Nexmo
- Gupshup
- Plivo
- SMS77
- SNS
- Telnyx
- Termii

### Chat

- Discord
- Slack

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
