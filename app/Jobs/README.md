# What are Jobs?

Jobs are a way to define a task that should be executed at a specific time. They are a Stacks primitive that may be called from anywhere in your application.

> [!TIP]
> Jobs can also be executed on a schedule, using cron syntax. Simply define the `rate` at which the job should run, and Stacks will take care of the rest.

## Get Started

The following command will bootstrap a new job file in the `app/Jobs` directory.

```sh
buddy make:job ExampleJob
```

```sh

### Example

A simple example of a job that logs a message. _For a closer look, take a peak at the [ExampleJob.ts](./ExampleJob.ts)._

```ts
export interface JobOptions {
  /**
   * The name of the job.
   */
  name?: string
  description?: string
  handle?: string | Function
  action?: string // the ActionName. Typed support incoming
  timezone?: string
  /**
   * Number of tries. Must be between 0 and 185.
   */
  tries?: IntRange<0, 185>
  backoff?: number | number[]
  rate?: string | Every
  enabled?: boolean
}

const options: JobOptions = {
  name: 'Example Job', // optional, defaults to the file name
  description: 'A demo (cron) job that runs every minute', // optional, used in the dashboard for context
  tries: 3, // optional, defaults to 3 retries (in case of failures)
  backoff: 3, // optional, defaults to 3-second delays between retries
  rate: Every.Minute, // optional, '* * * * *' in cron syntax
  handle: () => { // action: 'SendWelcomeEmail', // instead of handle, you may target an action or `action: () => {`
    log.info('This message logs every minute') // unless triggered via a route.job() call, in which case it logs once
  },
}

export default new Job(options)
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
