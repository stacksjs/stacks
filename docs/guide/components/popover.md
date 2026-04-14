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
    <PopoverButton class="px-4 py-2 text-white bg-blue-500 rounded">
      Solutions
    </PopoverButton>

    <PopoverPanel class="absolute z-10 mt-3 px-4 max-w-sm w-screen">
      <div class="overflow-hidden ring-1 ring-black ring-opacity-5 rounded-lg shadow-lg">
        <div class="grid relative gap-8 p-7 bg-white">
          <a
            href="#"
            class="flex items-center -m-3 p-2 hover:bg-gray-50 rounded-lg duration-150 ease-in-out transition"
          >
            <div class="ml-4">
              <p class="font-medium text-gray-900 text-sm">
                Analytics
              </p>
              <p class="text-gray-500 text-sm">
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
    enter-active-class="duration-200 ease-out transition"
    enter-from-class="opacity-0 translate-y-1"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="duration-150 ease-in transition"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-1"
  >
    <div v-if="open" class="ring-1 ring-black ring-opacity-5 rounded-lg shadow-lg">
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
