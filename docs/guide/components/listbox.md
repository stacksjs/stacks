# Listbox

A modern, accessible listbox component for Vue applications.

<ListboxDemo />

## Features

- 🎯 Fully accessible (WAI-ARIA compliant)
- 🌐 Keyboard navigation support
- 🎨 Customizable styling
- 📱 Mobile-friendly
- 🎯 TypeScript support

<br>

## Install

::: code-group

```sh [npm]
npm install @stacksjs/listbox
```

```sh [bun]
bun install @stacksjs/listbox
# bun add @stacksjs/listbox
# bun i @stacksjs/listbox
```

```sh [pnpm]
pnpm add @stacksjs/listbox
# pnpm i @stacksjs/listbox
```

```sh [yarn]
yarn add @stacksjs/listbox
# yarn i -d @stacksjs/listbox
```

:::
<br>

## Usage

The listbox component is composed of several sub-components that work together to create a fully functional and accessible listbox:

```vue
<script setup>
import { ref } from 'vue'
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@stacksjs/listbox'

const people = [
  { id: 1, name: 'Durward Reynolds', unavailable: false },
  { id: 2, name: 'Kenton Towne', unavailable: false },
  { id: 3, name: 'Therese Wunsch', unavailable: false },
  { id: 4, name: 'Benedict Kessler', unavailable: true },
  { id: 5, name: 'Katelyn Rohan', unavailable: false },
]

const selectedPerson = ref(people[0])
</script>

<template>
  <Listbox v-model="selectedPerson">
    <ListboxButton>{{ selectedPerson.name }}</ListboxButton>
    <ListboxOptions>
      <ListboxOption
        v-for="person in people"
        :key="person.id"
        :value="person"
        :disabled="person.unavailable"
      >
        {{ person.name }}
      </ListboxOption>
    </ListboxOptions>
  </Listbox>
</template>
```

## API Reference

### Listbox

The root component that wraps all listbox elements.

#### Props

- `v-model` - The selected value(s)
- `disabled` - (boolean) Whether the listbox is disabled
- `as` - (string) The element to render as (default: 'template')

### ListboxButton

The button that toggles the listbox options.

#### Props

- `as` - (string) The element to render as (default: 'button')

### ListboxOptions

The container for the list of options.

#### Props

- `as` - (string) The element to render as (default: 'ul')
- `static` - (boolean) Whether the options should always be rendered

### ListboxOption

Individual option items within the listbox.

#### Props

- `value` - The value associated with the option
- `disabled` - (boolean) Whether the option is disabled
- `as` - (string) The element to render as (default: 'li')

#### Slot Props

The ListboxOption component exposes the following slot props:

- `active` - (boolean) Whether the option is currently active (focused)
- `selected` - (boolean) Whether the option is currently selected
- `disabled` - (boolean) Whether the option is disabled

## Styling

The listbox components can be styled using standard CSS classes. Each component accepts standard HTML attributes including `class` and `style`.

For dynamic styling based on state, use the slot props provided by ListboxOption:

```vue
<ListboxOption v-slot="{ active, selected }">
  <li :class="{
    'bg-blue-500 text-white': active,
    'bg-white text-black': !active,
    'font-bold': selected
  }">
    {{ option.name }}
  </li>
</ListboxOption>
```

## Accessibility

The listbox component follows WAI-ARIA guidelines and includes the following features:

- Full keyboard navigation support
- ARIA attributes automatically managed
- Screen reader announcements for selection changes
- Focus management

## TypeScript Support

The listbox component includes full TypeScript support. You can specify the type of your items:

```ts
interface Person {
  id: number
  name: string
  unavailable: boolean
}

const selectedPerson = ref<Person | null>(null)
const people = ref<Person[]>([])
```

Still have questions relating this component's usage? Contact us and we will help you out. In the meantime, if you are curious about the [`<Notification />`](./notification.md) component read more on the next page.
