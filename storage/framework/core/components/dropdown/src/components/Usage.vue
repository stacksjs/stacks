<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from '../composables/useCopyCode'

const code = `<!-- App.vue -->
<script lang="ts" setup>
 import { Menu, MenuButton, MenuItems, MenuItem } from '@stacksjs/dropdown'
<\/script>

<template>
 <!-- ... -->
  <Menu>
    <MenuButton>More</MenuButton>
    <MenuItems>
      <MenuItem v-slot="{ active }">
        <a :class='{ "bg-blue-500": active }' href="/account-settings">
          Account settings
        </a>
      </MenuItem>
      <MenuItem v-slot="{ active }">
        <a :class='{ "bg-blue-500": active }' href="/account-settings">
          Documentation
        </a>
      </MenuItem>
      <MenuItem disabled>
        <span class="opacity-75">Invite a friend (coming soon!)</span>
      </MenuItem>
    </MenuItems>
  </Menu>
</template>
`

const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({ code, checkIconRef: showCheckIcon })
}
</script>

<template>
  <div class="usage">
    <h1 class="my-2 text-lg font-semibold">
      Usage
    </h1>
    <p class="my-3 text-base">
      Menu Buttons are built using the Menu, MenuButton, MenuItems, and MenuItem components.

      The MenuButton will automatically open/close the MenuItems when clicked, and when the menu is open, the list of items receives focus and is automatically navigable via the keyboard.
    </p>
    <div class="code-block group relative">
      <Highlight
        class-name="rounded-md text-xs"
        language="xml"
        :autodetect="false"
        :code="code"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="btn-border absolute right-2 top-2 hidden p-1 group-hover:block"
        @click="handleCopyCode"
      >
        <div v-if="showCheckIcon" class="i-ic:baseline-check text-gray-500" />
        <div v-else class="i-ic:baseline-content-copy text-gray-500" />
      </button>
    </div>
  </div>
</template>
