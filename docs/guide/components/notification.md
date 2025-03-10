# Notification

A modern, accessible notification component for Vue applications.

<NotificationDemo />

## Features

- 🎯 Fully accessible (WAI-ARIA compliant)
- 🎨 Customizable theming and styling
- 📱 Multiple positioning options
- 🔄 Expandable notifications
- 🌓 Light/Dark theme support
- 🎯 TypeScript support

<br>

## Install

::: code-group

```sh [npm]
npm install @stacksjs/notification
```

```sh [bun]
bun install @stacksjs/notification
# bun add @stacksjs/notification
# bun i @stacksjs/notification
```

```sh [pnpm]
pnpm add @stacksjs/notification
# pnpm i @stacksjs/notification
```

```sh [yarn]
yarn add @stacksjs/notification
# yarn i -d @stacksjs/notification
```

:::
<br>

## Usage

The notification component can be easily integrated into your Vue application:

```vue
<script setup>
import { ref } from 'vue'
import { Notification } from '@stacksjs/notification'

const position = ref('top-right')
const expand = ref(false)
const theme = ref('light')
const richColors = ref(false)
const closeButton = ref(false)

</script>

<template>
  <Notification
    :position="position"
    :expand="expand"
    :theme="theme"
    :rich-colors="richColors"
    :close-button="closeButton"
  />
</template>
```

<br>

## API Reference

### Notification

The main notification component that handles displaying notifications.

#### Props

- `position` - (string) Position of the notification ('top-right', 'top-left', 'bottom-right', 'bottom-left')
- `expand` - (boolean) Whether notifications should expand
- `theme` - (string) Theme of notifications ('light' | 'dark')
- `richColors` - (boolean) Enable rich color variants
- `closeButton` - (boolean) Show close button on notifications

### Position Options

The notification component supports various positioning options:

- `top-right` (default)
- `top-left`
- `bottom-right`
- `bottom-left`

### Theming

The component supports both light and dark themes out of the box:

```vue
<Notification :theme="isDarkMode ? 'dark' : 'light'" />
```

## Styling

The notification component can be styled using standard CSS classes and supports custom styling:

```vue
<Notification class="custom-notification">
  <!-- Your notification content -->
</Notification>
```

Example custom styling:

```css
.custom-notification {
  /* Your custom styles */
  --notification-background: #ffffff;
  --notification-border: 1px solid #e2e8f0;
  --notification-text: #1a202c;
}
```

## Accessibility

The notification component follows WAI-ARIA guidelines and includes:

- Proper ARIA roles and attributes
- Keyboard navigation support
- Screen reader announcements
- Focus management

## TypeScript Support

The notification component includes full TypeScript support:

```ts
import type { Position, Theme } from '@stacksjs/notification'

const position = ref<Position>('top-right')
const theme = ref<Theme>('light')
```

Still have questions about this component's usage? Contact us and we will help you out.
