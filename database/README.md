# The Database Folder

The database directory is where you would store your custom migrations and seeds.

> [!TIP]
> You may not need the database folder at all. Defining your models may be enough for your use case. Read more.

## Get Started

The following command will bootstrap a new migration file in the `database/migrations` directory:

```bash
# automated migrations
buddy migrate
```

```bash
# automated seeds
buddy seed
```

In case you need more seeding customization, you can create a `./database/seeder.ts` which, if found, is triggered instead.

Click here to learn more.

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
