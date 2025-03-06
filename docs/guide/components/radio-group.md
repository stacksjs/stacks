# Radio Group

A modern, accessible radio group component for Vue applications.

<RadioGroupDemo />

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
npm install @stacksjs/radio-group
```

```sh [bun]
bun install @stacksjs/radio-group
# bun add @stacksjs/radio-group
# bun i @stacksjs/radio-group
```

```sh [pnpm]
pnpm add @stacksjs/radio-group
# pnpm i @stacksjs/radio-group
```

```sh [yarn]
yarn add @stacksjs/radio-group
# yarn i -d @stacksjs/radio-group
```

:::
<br>

## Usage

The radio group component is composed of several sub-components that work together to create a fully functional and accessible radio group:

```vue
<script setup>
import { ref } from 'vue'
import {
  RadioGroup,
  RadioGroupLabel,
  RadioGroupOption,
} from '@stacksjs/radio-group'

const plans = [
  { id: 1, name: 'Startup', price: '$29' },
  { id: 2, name: 'Business', price: '$99' },
  { id: 3, name: 'Enterprise', price: '$249' },
]

const selected = ref(plans[0])
</script>

<template>
  <RadioGroup v-model="selected">
    <RadioGroupLabel>Plan</RadioGroupLabel>
    <div class="space-y-2">
      <RadioGroupOption
        v-for="plan in plans"
        :key="plan.id"
        :value="plan"
        v-slot="{ checked }"
      >
        <div :class="['p-4', checked ? 'bg-blue-500 text-white' : 'bg-white']">
          <div class="font-medium">{{ plan.name }}</div>
          <div>{{ plan.price }}/month</div>
        </div>
      </RadioGroupOption>
    </div>
  </RadioGroup>
</template>
```

## API Reference

### RadioGroup

The root component that wraps all radio group elements.

#### Props

- `v-model` - The selected value
- `disabled` - (boolean) Whether the radio group is disabled
- `as` - (string) The element to render as (default: 'div')

### RadioGroupLabel

The label component for the radio group.

#### Props

- `as` - (string) The element to render as (default: 'label')

### RadioGroupOption

Individual radio options within the group.

#### Props

- `value` - The value associated with the option
- `disabled` - (boolean) Whether the option is disabled
- `as` - (string) The element to render as (default: 'div')

#### Slot Props

The RadioGroupOption component exposes the following slot props:

- `checked` - (boolean) Whether the option is currently selected
- `disabled` - (boolean) Whether the option is disabled
- `active` - (boolean) Whether the option is currently active (focused)

## Styling

The radio group components can be styled using standard CSS classes. Each component accepts standard HTML attributes including `class` and `style`.

For dynamic styling based on state, use the slot props provided by RadioGroupOption:

```vue
<RadioGroupOption v-slot="{ checked, active }">
  <div :class="{
    'bg-blue-500 text-white': checked,
    'bg-white text-black': !checked,
    'ring-2 ring-blue-500': active
  }">
    {{ option.name }}
  </div>
</RadioGroupOption>
```

## Accessibility

The radio group component follows WAI-ARIA guidelines and includes the following features:

- Full keyboard navigation support
- ARIA attributes automatically managed
- Screen reader announcements for selection changes
- Focus management

## TypeScript Support

The radio group component includes full TypeScript support. You can specify the type of your items:

```ts
interface Plan {
  id: number
  name: string
  price: string
}

const selected = ref<Plan | null>(null)
const plans = ref<Plan[]>([])
```

Still have questions relating this component's usage? Contact us and we will help you out. In the meantime, if you are curious about the [`<Switch />`](./switch.md) component read more on the next page.
