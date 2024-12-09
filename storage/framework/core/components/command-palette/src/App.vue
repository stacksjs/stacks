<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useMagicKeys } from '@vueuse/core'

import { isDark, toggleDarkmode } from './composables/useDarkmode'
import Linear from './components/command/Linear.vue'
import Vercel from './components/command/vercel/Vercel.vue'
import Raycast from './components/command/raycast/Raycast.vue'
import Self from './components/command/Self.vue'
import Logo from './components/icons/Logo.vue'
import SunIcon from './components/icons/SunIcon.vue'
import MoonIcon from './components/icons/MoonIcon.vue'

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
  <div class="w-full h-full">
    <div class="container mx-auto max-w-5xl relative">
      <nav class="h-20 py-4 flex-between text-[var(--app-text)]">
        <div class="font-semibold text-xl flex-center gap-2">
          <Logo class="h-6 w-6" />
          Vue Command Palette
        </div>
        <div class="flex-center gap-4">
          <button
            class="bg-transparent opacity-50 hover:opacity-100 transition"
            @click="(e) => toggleDarkmode()"
          >
            <MoonIcon v-if="isDark" class="w-6 h-6" />
            <SunIcon v-else class="w-6 h-6" />
          </button>
          <a
            class="opacity-50 hover:opacity-100 transition"
            href="https://github.com/xiaoluoboding/vue-command-palette"
          >
            <carbon:logo-github class="h-6 w-6" />
          </a>
        </div>
      </nav>
      <header class="py-20">
        <div class="font-extrabold">
          <span class="text-6xl text-neon"> A Command Palette </span>
          <div class="text-6xl text-[var(--app-text)]">
            for Vue
          </div>
        </div>
        <div
          class="text-2xl font-semibold text-slate-700 py-4 dark:text-slate-200"
        >
          Fast, composable, unstyled command palette for Vue.
        </div>
        <div class="flex gap-4 mt-8">
          <a
            class="bg-gray-200 hover:bg-gray-300 transition rounded-full text-lg font-semibold py-3 px-6 w-full sm:w-auto text-center"
            href="https://github.com/xiaoluoboding/vue-command-palette"
          >Documentation</a>
          <button
            class="bg-emerald-400 hover:bg-emerald-500 flex items-center justify-center space-x-3 transition rounded-full text-white text-lg font-semibold py-3 px-6 w-full sm:w-auto cursor-pointer"
            @click="isOpenDialog = true"
          >
            <span>Try it out</span>
            <span class="space-x-1 hidden sm:inline-flex">
              <span
                class="bg-gradient-to-b text-sm from-white via-white to-gray-200 pb-0.5 pt-px px-1 text-gray-800 rounded"
              >
                ⌘
              </span>
              <span
                class="bg-gradient-to-b text-sm from-white via-white to-gray-200 pb-0.5 pt-px px-1 text-gray-800 rounded"
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
        class="mt-16 w-full flex-center text-[var(--app-text)]"
        text="slate-900 dark:slate-300 opacity-60 sm"
      >
        <div class="copyright flex flex-col justify-center items-center">
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

      <div class="w-full mx-auto">
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
