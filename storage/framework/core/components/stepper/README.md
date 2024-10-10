# Stacks Stepper

The *Stepper* component is a versatile & customizable component for creating multi-step processes in your application. It allows users to navigate through a sequence of steps, providing a visual indicator of their progress. This is oftentimes used to build to welcome the user into your application.

## ☘️ Features

- Customizable steps
- Linear and non-linear stepper modes
- Step validation
- Configurable labels and icons
- Callback events for step changes
- Lightweight

## 🤖 Usage

```bash
bun install -d @stacksjs/stepper
```

```ts
// App.vue
import { Stepper } from '@stacksjs/stepper'

const steps = ref(5)
const step = ref(1)
const stepper = ref(null)

// <Stepper ref='stepper' :steps="steps" v-model='step' />

// <template v-if="step === 1">
//   <div> </div>
// </template>

// <template v-if="step === 2">
//   <div> </div>
// </template>
```

To view the full documentation, please visit [stacksjs.org/docs/components/stepper](stacksjs.org/docs/components/stepper).

## 🧪 Testing

```bash
bun test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 🙏🏼 Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [Collect.js](https://github.com/ecrmnn/collect.js)
- [Laravel](https://laravel.com/)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
