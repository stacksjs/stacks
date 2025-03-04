<Hero
  title="stacks/listbox"
  description="An opinionated listbox component for Stacks."
  link="https://github.com/stacksjs/stacks/tree/main/storage/framework/core/components/listbox"
/>
<br>

# Install

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

# Usage

```vue
<!-- App.vue -->
<script lang="ts" setup>
import { ref } from 'vue'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@stacksjs/listbox'

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

<br>

# Demo

<ListboxDemo />

<br>
<br>

Still have questions relating this component’s usage? Contact us and we will help you out. In the meantime, if you are curious about the [`<Notification />`](./notification.md) component read more on the next page.
