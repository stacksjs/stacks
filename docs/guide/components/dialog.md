# Dialog

A modern, accessible dialog component for Vue applications.

<DialogDemo />

## Features

- 🎯 Fully accessible (WAI-ARIA compliant)
- 🌐 Keyboard navigation support
- 🎨 Customizable styling
- 🔄 Smooth transitions
- 📱 Mobile-friendly
- 🎯 TypeScript support

<br>

## Install

::: code-group

```sh [npm]
npm install @stacksjs/dialog
```

```sh [bun]
bun install @stacksjs/dialog
# bun add @stacksjs/dialog
# bun i @stacksjs/dialog
```

```sh [pnpm]
pnpm add @stacksjs/dialog
# pnpm i @stacksjs/dialog
```

```sh [yarn]
yarn add @stacksjs/dialog
# yarn i -d @stacksjs/dialog
```

:::
<br>

## Usage

The dialog component is composed of two main components that work together to create a fully functional and accessible modal dialog:

```vue
<script setup>
import { ref } from 'vue'
import { Dialog, DialogPanel } from '@stacksjs/dialog'

const visible = ref(false)

const handleClose = () => {
  visible.value = false
}
</script>

<template>
  <Transition name="fade" appear>
    <Dialog v-if="visible" @close="handleClose">
      <DialogPanel as="div" class="p-6 bg-white dark:bg-neutral-800 rounded-lg shadow-xl">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Greetings! This is a dialog.</h2>
          <button @click="handleClose" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <i class="hgi hgi-stroke hgi-x-close" />
          </button>
        </div>
        <div class="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <i class="hgi hgi-stroke hgi-info-circle" />
          <p>This is an example of using HugeIcons in a dialog.</p>
        </div>
      </DialogPanel>
    </Dialog>
  </Transition>

  <button
    @click="visible = true"
    class="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
  >
    <i class="hgi hgi-stroke hgi-presentation-bar-chart-01" />
    <span>Open Dialog</span>
  </button>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity .4s linear;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

<br>

## API Reference

### Dialog

The root component that wraps the dialog content.

#### Props

- `as` - (string) The element to render as (default: 'template')

#### Events

- `@close` - Emitted when the dialog should be closed (e.g., when clicking outside or pressing ESC)

### DialogPanel

The panel component that contains the dialog content.

#### Props

- `as` - (string) The element to render as (default: 'div')

## Styling

The dialog components can be styled using standard CSS classes. Each component accepts standard HTML attributes including `class` and `style`.

Example of styling with transitions:

```vue
<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity .4s linear;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

## Accessibility

The dialog component follows WAI-ARIA guidelines and includes the following features:

- Proper focus management
- Keyboard navigation (ESC to close)
- ARIA attributes automatically managed
- Click outside to close functionality
- Screen reader announcements

## TypeScript Support

The dialog component includes full TypeScript support:

```ts
import type { DialogProps } from '@stacksjs/dialog'
import { ref } from 'vue'

const visible = ref<boolean>(false)
```

Still have questions relating this component's usage? Contact us and we will help you out. In the meantime, if you are curious about the [`<Dropdown />`](./dropdown.md) component read more on the next page.
