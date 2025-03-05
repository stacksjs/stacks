# Combobox

A modern, accessible combobox component for Vue applications.

<ComboboxDemo />

## Features

- 🎯 Fully accessible (WAI-ARIA compliant)
- 🌐 Keyboard navigation support
- 🎨 Customizable styling
- 🔄 Dynamic filtering
- 📱 Mobile-friendly
- 🎯 TypeScript support

<br>

## Install

::: code-group

```sh [npm]
npm install @stacksjs/combobox
```

```sh [bun]
bun install @stacksjs/combobox
# bun add @stacksjs/combobox
# bun i @stacksjs/combobox
```

```sh [pnpm]
pnpm add @stacksjs/combobox
# pnpm i @stacksjs/combobox
```

```sh [yarn]
yarn add @stacksjs/combobox
# yarn i -d @stacksjs/combobox
```

:::
<br>

## Usage

The combobox component is composed of several sub-components that work together to create a fully functional and accessible combobox:

```vue
<script setup>
import { ref } from 'vue'
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption
} from '@stacksjs/combobox'

const selected = ref(null)
const query = ref('')
</script>

<template>
  <Combobox v-model="selected">
    <ComboboxInput @change="query = $event.target.value" />
    <ComboboxButton />
    <ComboboxOptions>
      <ComboboxOption v-for="item in items" :key="item.id" :value="item">
        {{ item.name }}
      </ComboboxOption>
    </ComboboxOptions>
  </Combobox>
</template>
```

<br>

## API Reference

### Combobox

The root component that wraps all combobox elements.

#### Props

- `v-model` - The selected value(s)
- `disabled` - (boolean) Whether the combobox is disabled
- `as` - (string) The element to render as (default: 'template')

### ComboboxInput

The input element of the combobox.

#### Props

- `displayValue` - (Function) Function to format the display value
- `placeholder` - (string) Input placeholder text

#### Events

- `@change` - Emitted when the input value changes
- `@focus` - Emitted when the input receives focus
- `@blur` - Emitted when the input loses focus

### ComboboxButton

The button that toggles the combobox options.

#### Props

- `as` - (string) The element to render as (default: 'button')

### ComboboxOptions

The container for the list of options.

#### Props

- `as` - (string) The element to render as (default: 'ul')
- `static` - (boolean) Whether the options should always be rendered
- `hold` - (boolean) Whether to maintain the options in the DOM when hidden

### ComboboxOption

Individual option items within the combobox.

#### Props

- `value` - The value associated with the option
- `disabled` - (boolean) Whether the option is disabled
- `as` - (string) The element to render as (default: 'li')

#### Slot Props

The ComboboxOption component exposes the following slot props:

- `active` - (boolean) Whether the option is currently active (focused)
- `selected` - (boolean) Whether the option is currently selected
- `disabled` - (boolean) Whether the option is disabled

## Styling

The combobox components can be styled using standard CSS classes. Each component accepts standard HTML attributes including `class` and `style`.

For dynamic styling based on state, use the slot props provided by ComboboxOption:

```vue
<ComboboxOption v-slot="{ active, selected }">
  <li :class="{
    'bg-blue-500 text-white': active,
    'bg-white text-black': !active,
    'font-bold': selected
  }">
    {{ option.name }}
  </li>
</ComboboxOption>
```

## Accessibility

The combobox component follows WAI-ARIA guidelines and includes the following features:

- Full keyboard navigation support
- ARIA attributes automatically managed
- Screen reader announcements for selection changes
- Focus management

## TypeScript Support

The combobox component includes full TypeScript support. You can specify the type of your items:

```ts
interface Item {
  id: number
  name: string
}

const selected = ref<Item | null>(null)
const items = ref<Item[]>([])
```

Still have questions relating this component’s usage? Contact us and we will help you out. In the meantime, if you are curious about the [`<CommandPalette />`](./command-palette.md) component read more on the next page.
