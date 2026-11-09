# Stacks Frontend

This package contains Stacks browser APIs. Import module APIs explicitly; the STX runtime and compiler determine which composables are available without imports.

## Native model geometry

`@stacksjs/browser/model-viewer` supports native box, tube and cylinder shapes,
same-origin binary STL files, and indexed inline meshes for procedural models.
Pass the scene to the STX `ModelViewer` component.

```ts
import type { ModelScene } from '@stacksjs/browser/model-viewer'

const scene: ModelScene = {
  nodes: [{
    id: 'panel',
    geometry: {
      kind: 'mesh',
      vertices: [[0, 0, 0], [100, 0, 0], [0, 50, 0]],
      triangles: [[0, 1, 2]],
    },
    color: '#254b38',
  }],
}
```

Coordinates follow the same authored units as the rest of the scene. Vertices
and triangle indices are JSON-compatible triples. The viewer validates array
sizes, finite Float32 coordinates, integer in-range indices and repeated
indices. Each mesh permits up to 500,000 vertices and 500,000 triangles, subject
to the existing whole-scene detail limit. Input arrays are copied, not mutated.
Inline meshes require no file request or persistent STL cache entry. The STL
loader retains its same-origin requirement; inline meshes do not enable remote
URLs. Rendering geometry does not establish its physical safety or suitability.

## ☘️ Features

- Browser-ready APIs
- Auto-imported into your projects

## 📦 Installation

```bash
bun install -d @stacksjs/browser
```

## 🤖 Usage

```bash
bun install -d @stacksjs/browser
```

You may now use:

```ts
// ...
```

Learn more in the docs.

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

[Join the Stacks Discord Server](https://stacksjs.com/discord)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
