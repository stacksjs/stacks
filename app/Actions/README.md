# What are Actions?

Actions introduce a concept of unique code reusability. They are "functions" that can be called from anywhere in the application. For example, they may be used as a ...

- CLI Command
- HTTP Controller
- Event Listener
- Cron Job
- Queue Worker

In other words, it is a Stacks primitive that may be called from anywhere in your application. Simplified API development, allowing you to move faster.

> [!TIP]
> Your "business logic" should be defined as Actions. This allows you to easily reuse your code across different parts of your application, without having to worry about scalability.

## Get Started

The following command will bootstrap a new action file in the `app/Actions` directory.

```sh
buddy make:action SendWelcomeEmail
```

### Example

A simple example of an Action that sends a welcome email. _For a closer look, take a look at the [SendWelcomeEmail](./ExampleAction.ts) example action._

```ts
export default new Action({
  name: 'SendWelcomeEmail', // could be anything, like `send-welcome-email` or `Send Welcome EmAiL`
  description: 'An optional description of the action.',

  async handle() {
    return sendEmail({
      to: 'some@recipient.com',
      subject: 'Welcome to our app!',
      text: 'We are excited to have you here.',
    })
  },
})
```

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 📄 License

The MIT License (MIT). Please see [LICENSE](../../LICENSE.md) for more information.

Made with 💙
