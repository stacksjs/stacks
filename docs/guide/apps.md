# Apps

Stacks enables you to build multiple types of applications from a single codebase: web apps, desktop apps, mobile apps, and CLI tools. Share code between platforms while optimizing for each target.

## Overview

Stacks app types:

- **Web Apps** - SPA, SSR, or static sites
- **Desktop Apps** - Native apps with Tauri
- **Mobile Apps** - iOS and Android with Capacitor
- **CLI Apps** - Command-line tools
- **Libraries** - Reusable packages

## Web Applications

### Single Page Applications (SPA)

```bash
# Create SPA
buddy make:app web --spa

# Development server
buddy dev

# Build for production
buddy build
```

### Server-Side Rendering (SSR)

```bash
# Create SSR app
buddy make:app web --ssr

# Development
buddy dev

# Build
buddy build
```

### Configuration

```typescript
// config/app.ts
export default defineAppConfig({
  type: 'web',

  ssr: {
    enabled: true,
    streaming: true,
  },

  build: {
    target: 'esnext',
    minify: true,
    sourcemap: true,
  },

  server: {
    port: 3000,
    host: 'localhost',
  },
})
```

## Desktop Applications

### Tauri Integration

Stacks uses Tauri for building native desktop apps with web technologies.

```bash
# Create desktop app
buddy make:app desktop

# Development mode
buddy dev:desktop

# Build for all platforms
buddy build:desktop

# Build for specific platform
buddy build:desktop --target macos
buddy build:desktop --target windows
buddy build:desktop --target linux
```

### Desktop Configuration

```typescript
// config/desktop.ts
export default defineDesktopConfig({
  productName: 'My App',
  identifier: 'com.mycompany.myapp',
  version: '1.0.0',

  windows: {
    width: 1200,
    height: 800,
    resizable: true,
    title: 'My Desktop App',
  },

  bundle: {
    icon: 'public/icon.png',
    category: 'Productivity',
  },

  security: {
    csp: "default-src 'self'",
  },
})
```

### Native APIs

Access native desktop APIs:

```typescript
// Access file system
import { open, save } from '@tauri-apps/api/dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/api/fs'

async function openFile() {
  const path = await open({
    filters: [{ name: 'Text', extensions: ['txt', 'md'] }]
  })

  if (path) {
    const content = await readTextFile(path as string)
    return content
  }
}

// System notifications
import { sendNotification } from '@tauri-apps/api/notification'

await sendNotification({
  title: 'Task Complete',
  body: 'Your export has finished.',
})

// Global shortcuts
import { register } from '@tauri-apps/api/globalShortcut'

await register('CommandOrControl+Shift+N', () => {
  console.log('Shortcut triggered')
})
```

### Menu Bar

```typescript
// config/desktop.ts
export default defineDesktopConfig({
  menu: {
    items: [
      {
        label: 'File',
        submenu: [
          { label: 'New', accelerator: 'CmdOrCtrl+N', action: 'new' },
          { label: 'Open', accelerator: 'CmdOrCtrl+O', action: 'open' },
          { label: 'Save', accelerator: 'CmdOrCtrl+S', action: 'save' },
          { type: 'separator' },
          { label: 'Quit', accelerator: 'CmdOrCtrl+Q', action: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { label: 'Undo', accelerator: 'CmdOrCtrl+Z', action: 'undo' },
          { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', action: 'redo' },
          { type: 'separator' },
          { label: 'Cut', accelerator: 'CmdOrCtrl+X', action: 'cut' },
          { label: 'Copy', accelerator: 'CmdOrCtrl+C', action: 'copy' },
          { label: 'Paste', accelerator: 'CmdOrCtrl+V', action: 'paste' },
        ],
      },
    ],
  },
})
```

## Mobile Applications

### Capacitor Integration

Build native mobile apps with Capacitor.

```bash
# Create mobile app
buddy make:app mobile

# Add platforms
buddy mobile:add ios
buddy mobile:add android

# Development
buddy dev:mobile

# Build
buddy build:mobile

# Open in native IDE
buddy mobile:open ios
buddy mobile:open android
```

### Mobile Configuration

```typescript
// config/mobile.ts
export default defineMobileConfig({
  appId: 'com.mycompany.myapp',
  appName: 'My App',

  ios: {
    scheme: 'MyApp',
    deploymentTarget: '13.0',
  },

  android: {
    minSdkVersion: 24,
    targetSdkVersion: 34,
  },

  plugins: [
    '@capacitor/camera',
    '@capacitor/geolocation',
    '@capacitor/push-notifications',
  ],
})
```

### Native Features

```typescript
// Camera
import { Camera, CameraResultType } from '@capacitor/camera'

async function takePhoto() {
  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: true,
    resultType: CameraResultType.Uri,
  })

  return photo.webPath
}

// Geolocation
import { Geolocation } from '@capacitor/geolocation'

async function getCurrentPosition() {
  const position = await Geolocation.getCurrentPosition()
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  }
}

// Push Notifications
import { PushNotifications } from '@capacitor/push-notifications'

await PushNotifications.requestPermissions()
await PushNotifications.register()

PushNotifications.addListener('pushNotificationReceived', (notification) => {
  console.log('Push received:', notification)
})
```

## CLI Applications

### Creating CLI Tools

```bash
# Create CLI app
buddy make:app cli

# Run CLI
bun run cli

# Build distributable
buddy build:cli
```

### CLI Configuration

```typescript
// config/cli.ts
export default defineCliConfig({
  name: 'my-cli',
  version: '1.0.0',
  description: 'My awesome CLI tool',

  commands: [
    {
      name: 'init',
      description: 'Initialize a new project',
      options: [
        { name: '--template', description: 'Project template' },
        { name: '--force', description: 'Overwrite existing files' },
      ],
    },
    {
      name: 'build',
      description: 'Build the project',
      options: [
        { name: '--watch', description: 'Watch for changes' },
      ],
    },
  ],
})
```

### Command Implementation

```typescript
// commands/init.ts
import { Command } from '@stacksjs/cli'

export default class InitCommand extends Command {
  static name = 'init'
  static description = 'Initialize a new project'

  static options = {
    template: {
      type: 'string',
      description: 'Project template',
      default: 'default',
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing files',
      default: false,
    },
  }

  async handle() {
    const { template, force } = this.options

    this.info(`Creating project with template: ${template}`)

    if (force) {
      this.warn('Force mode enabled - will overwrite existing files')
    }

    // Implementation
    await this.copyTemplate(template)

    this.success('Project created successfully!')
  }

  private async copyTemplate(template: string) {
    // Template copying logic
  }
}
```

### Interactive Prompts

```typescript
import { prompt } from '@stacksjs/cli'

const answers = await prompt([
  {
    type: 'text',
    name: 'name',
    message: 'Project name:',
  },
  {
    type: 'select',
    name: 'template',
    message: 'Choose a template:',
    choices: [
      { title: 'Default', value: 'default' },
      { title: 'Minimal', value: 'minimal' },
      { title: 'Full', value: 'full' },
    ],
  },
  {
    type: 'confirm',
    name: 'typescript',
    message: 'Use TypeScript?',
    initial: true,
  },
])
```

## Code Sharing

### Shared Components

```typescript
// components/Button.vue - Works in web, desktop, and mobile
<template>
  <button
    :class="['btn', `btn-${variant}`]"
    :disabled="loading"
    @click="$emit('click')"
  >
    <Spinner v-if="loading" />
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary'
  loading?: boolean
}>()

defineEmits<{
  click: []
}>()
</script>
```

### Platform-Specific Code

```typescript
// utils/storage.ts
import { isDesktop, isMobile, isWeb } from '@stacksjs/platform'

export async function saveData(key: string, data: any) {
  if (isDesktop()) {
    // Use Tauri file system
    const { writeTextFile } = await import('@tauri-apps/api/fs')
    await writeTextFile(key, JSON.stringify(data))
  } else if (isMobile()) {
    // Use Capacitor storage
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key, value: JSON.stringify(data) })
  } else {
    // Use localStorage
    localStorage.setItem(key, JSON.stringify(data))
  }
}
```

### Conditional Imports

```typescript
// Use dynamic imports for platform-specific modules
const storage = await import(
  isDesktop()
    ? './storage/desktop'
    : isMobile()
      ? './storage/mobile'
      : './storage/web'
)
```

## Build & Deploy

### Building All Platforms

```bash
# Build everything
buddy build:all

# Build specific platforms
buddy build:web
buddy build:desktop
buddy build:mobile
buddy build:cli
```

### Distribution

```bash
# Web - Deploy to cloud
buddy deploy

# Desktop - Create installers
buddy build:desktop --release

# Mobile - Build for app stores
buddy build:mobile --release

# CLI - Publish to npm
buddy publish:cli
```

## Best Practices

1. **Share code wisely** - Extract truly reusable logic
2. **Platform detection** - Use platform checks for specific features
3. **Progressive enhancement** - Start with web, add native features
4. **Test on all platforms** - Ensure consistency
5. **Optimize bundles** - Tree-shake platform-specific code

## Related

- [Components](/basics/components) - Building components
- [Configuration](/guide/config) - App configuration
- [Cloud Deployment](/guide/cloud) - Deploying apps
- [CLI Commands](/basics/commands) - Building CLI tools
