# Dropdown

A modern, accessible dropdown component for Vue applications.

<DropdownDemo />

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
npm install @stacksjs/dropdown
```

```sh [bun]
bun install @stacksjs/dropdown
# bun add @stacksjs/dropdown
# bun i @stacksjs/dropdown
```

```sh [pnpm]
pnpm add @stacksjs/dropdown
# pnpm i @stacksjs/dropdown
```

```sh [yarn]
yarn add @stacksjs/dropdown
# yarn i -d @stacksjs/dropdown
```

:::
<br>

## Usage

The dropdown component is composed of several sub-components that work together to create a fully functional and accessible dropdown:

```vue
<script setup>
import { ref } from 'vue'
import {
  Dropdown,
  DropdownButton,
  DropdownItems,
  DropdownItem,
} from '@stacksjs/dropdown'
</script>

<template>
  <Dropdown class="relative">
    <DropdownButton class="rounded bg-blue-500 px-4 py-2 text-white">
      Options
    </DropdownButton>

    <DropdownItems class="absolute z-10 mt-2 w-56 rounded-md bg-white shadow-lg">
      <DropdownItem v-slot="{ active }">
        <a
          href="/account-settings"
          :class="[
            'block px-4 py-2 text-sm',
            active ? 'bg-blue-500 text-white' : 'text-gray-900'
          ]"
        >
          Account settings
        </a>
      </DropdownItem>
      <DropdownItem v-slot="{ active }">
        <a
          href="/documentation"
          :class="[
            'block px-4 py-2 text-sm',
            active ? 'bg-blue-500 text-white' : 'text-gray-900'
          ]"
        >
          Documentation
        </a>
      </DropdownItem>
      <DropdownItem disabled>
        <span class="block px-4 py-2 text-sm text-gray-400">
          Invite a friend (coming soon!)
        </span>
      </DropdownItem>
    </DropdownItems>
  </Dropdown>
</template>
```

## API Reference

### Dropdown

The root component that wraps all dropdown elements.

#### Props

- `as` - (string) The element to render as (default: 'div')
- `static` - (boolean) Whether the dropdown should always be rendered

### DropdownButton

The button that toggles the dropdown menu.

#### Props

- `as` - (string) The element to render as (default: 'button')
- `disabled` - (boolean) Whether the button is disabled

### DropdownItems

The container for dropdown menu items.

#### Props

- `as` - (string) The element to render as (default: 'div')
- `static` - (boolean) Whether the items should always be rendered
- `unmount` - (boolean) Whether to unmount the items when closed

### DropdownItem

Individual menu items within the dropdown.

#### Props

- `disabled` - (boolean) Whether the item is disabled
- `as` - (string) The element to render as (default: 'div')

#### Slot Props

The DropdownItem component exposes the following slot props:

- `active` - (boolean) Whether the item is currently active (focused)
- `disabled` - (boolean) Whether the item is disabled
- `close` - (function) Method to close the dropdown

## Styling

The dropdown components can be styled using standard CSS classes. Each component accepts standard HTML attributes including `class` and `style`.

For dynamic styling based on state, use the slot props provided by DropdownItem:

```vue
<DropdownItem v-slot="{ active }">
  <a
    href="#"
    :class="[
      'block px-4 py-2 text-sm',
      active
        ? 'bg-blue-500 text-white'
        : 'text-gray-900 hover:bg-gray-100'
    ]"
  >
    {{ item.name }}
  </a>
</DropdownItem>
```

## Accessibility

The dropdown component follows WAI-ARIA guidelines and includes the following features:

- Proper ARIA attributes (aria-expanded, aria-haspopup)
- Keyboard navigation support
  - Enter/Space to open/close
  - Arrow keys for navigation
  - Escape to close
- Focus management and focus trap
- Screen reader announcements

## TypeScript Support

The dropdown component includes full TypeScript support:

```ts
import type { DropdownItemProps } from '@stacksjs/dropdown'
import { ref } from 'vue'

interface MenuItem {
  name: string
  href: string
  disabled?: boolean
}

const items = ref<MenuItem[]>([
  { name: 'Account settings', href: '/settings' },
  { name: 'Support', href: '/support' },
  { name: 'License', href: '/license', disabled: true },
])
```

Still have questions relating this component's usage? Contact us and we will help you out. In the meantime, if you are curious about the [`<Listbox />`](./listbox.md) component read more on the next page.
