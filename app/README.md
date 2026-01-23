# App Directory

This directory is for your custom application code that overrides the framework defaults.

## How Overrides Work

The Stacks framework first looks for files in this `app/` directory. If a file is not found here, it falls back to the defaults in `storage/framework/defaults/app/`.

## Common Override Locations

- **Actions/** - Custom action handlers for your routes
- **Controllers/** - Custom controllers
- **Jobs/** - Background job handlers
- **Middleware/** - Custom middleware
- **Models/** - Custom data models
- **Notifications/** - Custom notification handlers
- **Policies/** - Authorization policies

## Example: Overriding an Action

To override the default `PostIndexAction`, create:

```
app/Actions/Cms/PostIndexAction.ts
```

Your custom action will be used instead of the default.

## Creating New Files

Any new files you create here will be available to your application. For example, creating `app/Actions/MyCustomAction.ts` will make it available at `'Actions/MyCustomAction'` in your routes.

## Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## License

The MIT License (MIT). Please see [LICENSE](../../LICENSE.md) for more information.

Made with 💙
