---
title: Application Types
description: "Stacks enables you to build multiple types of applications from a single codebase: web apps, desktop apps, mobile apps, and CLI tools. Share code between p..."
---
# Apps

Stacks enables you to build multiple types of applications from a single codebase: web apps, desktop apps, mobile apps, and CLI tools. Share code between platforms while optimizing for each target.

## Overview

Stacks app types:

- **Web Apps** - SPA, SSR, or static sites
- **Desktop Apps** - Native apps with Craft
- **Mobile Apps** - iOS and Android with Capacitor
- **CLI Apps** - Command-line tools
- **Libraries** - Reusable packages

## Web Applications

### Single Page Applications (SPA)

```bash
# Create SPA
panx @stacksjs/buddy new my-app

# Development server
buddy dev

# Build for production
buddy build
```

### Server-Side Rendering (SSR)

```bash
# Create SSR app
panx @stacksjs/buddy new my-app

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

### Craft Integration

Stacks uses the first-party Craft runtime for native desktop apps. Craft opens the same stx application URL served through rpx and tlsx, so desktop and browser clients share routes, actions, authentication, and UI.

```bash
# Create desktop app
panx @stacksjs/buddy new my-app

# Development mode
buddy dev:desktop

# Build
buddy build:desktop
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

Craft exposes native APIs through its typed bridge. Put bridge access in a TypeScript function or composable and call that function from stx. The bridge covers windows, files, notifications, clipboard, processes, shortcuts, tray menus, and updates.

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
# The buddy mobile:* commands are not implemented yet
# Use the Capacitor CLI directly in the meantime

# Add platforms
bunx cap add ios
bunx cap add android

# Sync & open in the native IDE
bunx cap sync
bunx cap open ios
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
panx @stacksjs/buddy new my-cli

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
// resources/components/Button.stx
<script>
const { variant = 'primary', loading = false } = defineProps<{
  variant?: 'primary' | 'secondary'
  loading?: boolean
}>()
</script>

<button type="button" :disabled="loading" :data-variant="variant">
  <slot />
</button>
```

### Platform-Specific Code

```typescript
// resources/functions/storage.ts
export async function saveDesktopData(path: string, data: unknown): Promise<void> {
  const { writeTextFile } = await import('craft-native/api/fs')
  await writeTextFile(path, JSON.stringify(data))
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
# Build the platforms you ship
buddy build:frontend
buddy build:desktop
buddy build:cli
```

### Distribution

```bash
# Web - Deploy to cloud
buddy deploy

# Desktop - Create the production build
buddy build:desktop

# CLI - Publish to npm
buddy publish
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
