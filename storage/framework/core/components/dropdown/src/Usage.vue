<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const code = `<!-- App.vue -->
<script lang="ts" setup>
 import { Menu, MenuButton, MenuItems, MenuItem } from '@stacksjs/dropdown'
<\/script>

<template>
 <!-- ... -->
  <Dropdown>
    <DropdownButton>Dropdown</DropdownButton>
    <DropdownItems>
      <DropdownItem v-slot="{ active }">
        <a :class='{ "bg-blue-500": active }' href="/account-settings">
          Account settings
        </a>
      </DropdownItem>
      <DropdownItem v-slot="{ active }">
        <a :class='{ "bg-blue-500": active }' href="/account-settings">
          Documentation
        </a>
      </DropdownItem>
      <DropdownItem disabled>
        <span class="opacity-75">Invite a friend (coming soon!)</span>
      </DropdownItem>
    </DropdownItems>
  </Dropdown>
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
      Dropdowns are built using the <code><b>Dropdown</b></code>, <code><b>DropdownButton</b></code>, <code><b>DropdownItems</b></code>, and <code><b>DropdownItem</b></code> components.<br><br>

      The <code><b>DropdownButton</b></code> will automatically open/close the <code><b>DropdownItems</b></code> when clicked, and when the menu is open, the list of items receives focus and is automatically navigable via the keyboard.
    </p>
    <div class="group code-block relative">
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
        <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
        <div v-else class="i-hugeicons:copy-01 text-gray-500" />
      </button>
    </div>
    <p class="my-3 text-base">
      To learn more, read this part of the documentation, as much of <a class="text-blue-500" href="https://headlessui.com/v1/vue/menu" target="_blank">Headless UI</a> is proxied.
    </p>
  </div>
</template>
