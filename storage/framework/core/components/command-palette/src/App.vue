<script lang="ts" setup>
import { useMagicKeys } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import Linear from './components/command/Linear.vue'
import Raycast from './components/command/raycast/Raycast.vue'
import Self from './components/command/Self.vue'
import Vercel from './components/command/vercel/Vercel.vue'
import Logo from './components/icons/Logo.vue'
import MoonIcon from './components/icons/MoonIcon.vue'
import SunIcon from './components/icons/SunIcon.vue'
import { isDark, toggleDarkmode } from './composables/useDarkmode'

const isOpenDialog = ref(false)
const isOpenThemeDialog = ref(false)
const selectedView = ref('')
// const target = ref(null)
const currentDialog = computed(() => {
  if (selectedView.value === 'Linear')
    return Linear
  if (selectedView.value === 'Vercel')
    return Vercel
  if (selectedView.value === 'Raycast')
    return Raycast
  return Linear
})

const keys = useMagicKeys()
const CmdK = keys['Meta+K']
const Escape = keys.Escape

function handleChangeDialog(view = 'self') {
  const isSelf = view === 'self'
  selectedView.value = view
  isOpenDialog.value = isSelf
  isOpenThemeDialog.value = !isSelf
}
function handleOpenDialog(value: any) {
  if (value)
    isOpenDialog.value = true
  else
    isOpenDialog.value = false
}

watch(CmdK, (v) => {
  if (v) {
    console.log('Meta + K has been pressed')
    isOpenDialog.value = true
  }
})
watch(Escape, (v) => {
  if (v) {
    console.log('Escape has been pressed')
    isOpenDialog.value = false
    isOpenThemeDialog.value = false
  }
})
// onClickOutside(target, (event) => {
//   console.log('Clicked the outside element of Command K Palette')
//   isOpenDialog.value = false
// })

const demoCode1 = `<!-- <template> -->
<Command.Dialog :visible="visible" theme="custom">
  <template #header>
    <Command.Input placeholder="Type a command or search..." />
  </template>
  <template #body>
    <Command.List>
      <Command.Empty>No results found.</Command.Empty>

      <Command.Group heading="Letters">
        <Command.Item>a</Command.Item>
        <Command.Item>b</Command.Item>
        <Command.Separator />
        <Command.Item>c</Command.Item>
      </Command.Group>

      <Command.Item>Apple</Command.Item>
    </Command.List>
  </template>
</Command.Dialog>
`

const demoCode2 = `// <script lang="ts" setup>
import { ref } from 'vue'
import { Command } from 'vue-command-palette'

const visible = ref(false)
`
</script>

<template>
  <div class="h-full w-full">
    <div class="relative mx-auto max-w-5xl container">
      <nav class="flex-between h-20 py-4 text-[var(--app-text)]">
        <div class="flex-center gap-2 text-xl font-semibold">
          <Logo class="h-6 w-6" />
          Vue Command Palette
        </div>
        <div class="flex-center gap-4">
          <button
            class="bg-transparent opacity-50 transition hover:opacity-100"
            @click="(e) => toggleDarkmode()"
          >
            <MoonIcon v-if="isDark" class="h-6 w-6" />
            <SunIcon v-else class="h-6 w-6" />
          </button>
          <a
            class="opacity-50 transition hover:opacity-100"
            href="https://github.com/xiaoluoboding/vue-command-palette"
          >
            <carbon:logo-github class="h-6 w-6" />
          </a>
        </div>
      </nav>
      <header class="py-20">
        <div class="font-extrabold">
          <span class="text-neon text-6xl"> A Command Palette </span>
          <div class="text-6xl text-[var(--app-text)]">
            for Vue
          </div>
        </div>
        <div
          class="py-4 text-2xl text-slate-700 font-semibold dark:text-slate-200"
        >
          Fast, composable, unstyled command palette for Vue.
        </div>
        <div class="mt-8 flex gap-4">
          <a
            class="w-full rounded-full bg-gray-200 px-6 py-3 text-center text-lg font-semibold transition sm:w-auto hover:bg-gray-300"
            href="https://github.com/xiaoluoboding/vue-command-palette"
          >Documentation</a>
          <button
            class="w-full flex cursor-pointer items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-lg text-white font-semibold transition sm:w-auto space-x-3 hover:bg-emerald-500"
            @click="isOpenDialog = true"
          >
            <span>Try it out</span>
            <span class="hidden sm:inline-flex space-x-1">
              <span
                class="rounded from-white via-white to-gray-200 bg-gradient-to-b px-1 pb-0.5 pt-px text-sm text-gray-800"
              >
                ⌘
              </span>
              <span
                class="rounded from-white via-white to-gray-200 bg-gradient-to-b px-1 pb-0.5 pt-px text-sm text-gray-800"
              >
                K
              </span>
            </span>
          </button>
        </div>
      </header>

      <main class="grid grid-cols-1 gap-8 text-xs 2xl:text-sm">
        <Highlight :autodetect="false" language="html" :code="demoCode1" />
        <Highlight
          :autodetect="false"
          language="javascript"
          :code="demoCode2"
        />
      </main>

      <footer
        class="flex-center mt-16 w-full text-[var(--app-text)]"
        text="slate-900 dark:slate-300 opacity-60 sm"
      >
        <div class="copyright flex flex-col items-center justify-center">
          <p>
            Code with ❤ & ☕️ by
            <a class="text-neon" href="https://github.com/xiaoluoboding">
              @xiaoluoboding
            </a>
            <span> © {{ new Date().getFullYear() }}</span>
          </p>
          <p class="flex items-center space-x-1">
            <carbon:logo-twitter class="text-emerald-500" />
            <span>
              <a
                href="https://twitter.com/xiaoluoboding"
                class="text-neon"
                target="_blank"
              >
                Follow me on Twitter
              </a>
            </span>
            <span class="px-2 text-emerald-300">|</span>
            <carbon:cafe class="text-emerald-500" />
            <span>
              <a
                href="https://www.buymeacoffee.com/xlbd"
                target="_blank"
                class="text-neon"
              >
                Buy me a coffee
              </a>
            </span>
            <span class="px-2 text-emerald-300">|</span>
            <mdi:heart class="text-emerald-500" />
            <span>
              <a
                href="https://github.com/sponsors/xiaoluoboding"
                target="_blank"
                class="text-neon"
              >
                Sponsor me on GitHub
              </a>
            </span>
          </p>
        </div>
      </footer>

      <div class="mx-auto w-full">
        <Self
          :visible="isOpenDialog"
          @dialog="handleOpenDialog"
          @select="handleChangeDialog"
        />
        <component :is="currentDialog" v-if="isOpenThemeDialog" />
      </div>
    </div>
  </div>
</template>
