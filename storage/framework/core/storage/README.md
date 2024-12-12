# Stacks Storage

This package contains the Stacks File System source.

## ☘️ Features

- Easily create your own cloud storage
- Driver-based architecture
- Local, S3, and memory drivers
- Laravel-like Storage API

### TODO

- [ ] Add Google Cloud Storage driver
- [ ] Add Azure Blob Storage driver

## 🤖 Usage

```bash
bun install -d @stacksjs/storage
```

Now, you can use it in your project:

```js
import {
  _dirname,
  copyFolder,
  deleteEmptyFolders,
  deleteFiles,
  deleteFolder,
  doesFolderExist,
  fileURLToPath,
  fs, // fs-extra Node module
  hasComponents,
  hasFiles,
  hasFunctions,
  isFile,
  isFolder,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} from '@stacksjs/storage'

// wip
```

To view the full documentation, please visit [https://stacksjs.org/storage](https://stacksjs.org/storage).

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

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
