# Popover

A modern, accessible popover component for Vue applications.

<PopoverDemo />

## Features

- 🎯 Fully accessible (WAI-ARIA compliant)
- 🌐 Keyboard navigation support
- 🎨 Customizable styling
- 📱 Mobile-friendly
- 🎯 TypeScript support
- 🎈 Floating UI integration
- 🔄 Auto-positioning

<br>

## Install

::: code-group

```sh [npm]
npm install @stacksjs/popover
```

```sh [bun]
bun install @stacksjs/popover
# bun add @stacksjs/popover
# bun i @stacksjs/popover
```

```sh [pnpm]
pnpm add @stacksjs/popover
# pnpm i @stacksjs/popover
```

```sh [yarn]
yarn add @stacksjs/popover
# yarn i -d @stacksjs/popover
```

:::
<br>

## Usage

The popover component is composed of several sub-components that work together to create a fully functional and accessible popover:

```vue
<script setup>
import { ref } from 'vue'
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@stacksjs/popover'
</script>

<template>
  <Popover class="relative">
    <PopoverButton class="rounded bg-blue-500 px-4 py-2 text-white">
      Solutions
    </PopoverButton>

    <PopoverPanel class="absolute z-10 mt-3 w-screen max-w-sm px-4">
      <div class="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
        <div class="relative grid gap-8 bg-white p-7">
          <a
            href="#"
            class="-m-3 flex items-center rounded-lg p-2 transition duration-150 ease-in-out hover:bg-gray-50"
          >
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-900">
                Analytics
              </p>
              <p class="text-sm text-gray-500">
                Get a better understanding of your traffic
              </p>
            </div>
          </a>
        </div>
      </div>
    </PopoverPanel>
  </Popover>
</template>
```

## API Reference

### Popover

The root component that wraps all popover elements.

#### Props

- `as` - (string) The element to render as (default: 'div')
- `static` - (boolean) Whether the popover should always be rendered

### PopoverButton

The button that toggles the popover panel.

#### Props

- `as` - (string) The element to render as (default: 'button')
- `disabled` - (boolean) Whether the button is disabled

### PopoverPanel

The panel that contains the popover content.

#### Props

- `as` - (string) The element to render as (default: 'div')
- `static` - (boolean) Whether the panel should always be rendered
- `unmount` - (boolean) Whether to unmount the panel when closed

#### Slot Props

The PopoverPanel component exposes the following slot props:

- `open` - (boolean) Whether the panel is currently open
- `close` - (function) Method to close the panel

## Styling

The popover components can be styled using standard CSS classes. Each component accepts standard HTML attributes including `class` and `style`.

For dynamic positioning and transitions:

```vue
<PopoverPanel
  class="absolute z-10 mt-3"
  v-slot="{ open }"
>
  <transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-1 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-1 opacity-0"
  >
    <div v-if="open" class="rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
      <!-- Content -->
    </div>
  </transition>
</PopoverPanel>
```

## Accessibility

The popover component follows WAI-ARIA guidelines and includes the following features:

- Proper ARIA attributes (aria-expanded, aria-haspopup)
- Keyboard navigation support (Escape to close)
- Focus management and focus trap
- Screen reader announcements

## TypeScript Support

The popover component includes full TypeScript support:

```ts
import type { PopoverSlotProps } from '@stacksjs/popover'
import { ref } from 'vue'

const panelOpen = ref<boolean>(false)
```

Still have questions relating this component's usage? Contact us and we will help you out. In the meantime, if you are curious about the [`<Tabs />`](./tabs.md) component read more on the next page.
