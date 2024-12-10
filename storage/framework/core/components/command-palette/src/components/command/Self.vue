<script lang="ts" setup>
import { onClickOutside, useMagicKeys, whenever } from '@vueuse/core'
import { computed, ref } from 'vue'

import { Command, useCommandState } from '../../../packages'
import { isDark, toggleDarkmode } from '../../composables/useDarkmode'
import LinearIcon from '../icons/LinearIcon.vue'
import Logo from '../icons/Logo.vue'
import MoonIcon from '../icons/MoonIcon.vue'
import RaycastIcon from '../icons/RaycastIcon.vue'
import SunIcon from '../icons/SunIcon.vue'
import VercelIcon from '../icons/VercelIcon.vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits(['select', 'dialog'])
const el = ref<HTMLDivElement | null>(null)

const items = [
  {
    icon: LinearIcon,
    label: 'Linear',
    shortcut: ['L'],
    perform: () => {},
  },
  {
    icon: RaycastIcon,
    label: 'Raycast',
    shortcut: ['R'],
    perform: () => {},
  },
  {
    icon: VercelIcon,
    label: 'Vercel',
    shortcut: ['V'],
    perform: () => {},
  },
]

const preferenceItems = [
  {
    icon: SunIcon,
    label: 'Toggle Dark Mode',
    shortcut: ['G', 'T'],
    perform: () => toggleDarkmode(),
  },
]

const activePage = ref('home')
const inputValue = ref('')

const isHomePage = computed(() => activePage.value === 'home')

const { current } = useMagicKeys()
const { search } = useCommandState()

function togglePage() {
  activePage.value = 'home'
  emit('select', 'self')
}

whenever(
  () => current.has('backspace'),
  () => {
    const commandInputEl = document.querySelector(
      'input[command-input]',
    ) as HTMLInputElement
    if (
      isHomePage.value
      || inputValue.value.length
      || commandInputEl.value.length
    ) {
      return
    }
    togglePage()
  },
)

function handleSelectTheme(item: any) {
  activePage.value = item.value
  search.value = ''
  emit('select', item.value)
}
onClickOutside(el, (e: Event) => {
  const divEl = e.target as HTMLDivElement
  if (divEl?.hasAttribute('command-dialog-mask'))
    emit('dialog', false)
})
</script>

<template>
  <Command.Dialog ref="el" :visible="visible" theme="algolia">
    <template #header>
      <Command.Input
        v-model:value="inputValue"
        placeholder="Type a command or search..."
      />
    </template>
    <template #body>
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        <Command.Group heading="Theme">
          <Command.Item
            v-for="item in items"
            :data-value="item.label"
            :shortcut="item.shortcut"
            :perform="item.perform"
            @select="handleSelectTheme"
          >
            <component :is="item.icon" />
            <div>{{ item.label }}</div>
            <div command-linear-shortcuts class="hidden">
              <svg width="20" height="20" viewBox="0 0 20 20">
                <g
                  stroke="currentColor"
                  fill="none"
                  fill-rule="evenodd"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 3v4c0 2-2 4-4 4H2" />
                  <path d="M8 17l-6-6 6-6" />
                </g>
              </svg>
            </div>
          </Command.Item>
        </Command.Group>
        <Command.Group heading="Preference">
          <Command.Item
            v-for="item in preferenceItems"
            :key="item.label"
            :data-value="item.label"
            :shortcut="item.shortcut"
            :perform="item.perform"
            @select="() => toggleDarkmode()"
          >
            <MoonIcon v-if="isDark" class="h-6 w-6" />
            <SunIcon v-else class="h-6 w-6" />
            {{ item.label }}
            <div command-linear-shortcuts class="hidden">
              <svg width="20" height="20" viewBox="0 0 20 20">
                <g
                  stroke="currentColor"
                  fill="none"
                  fill-rule="evenodd"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 3v4c0 2-2 4-4 4H2" />
                  <path d="M8 17l-6-6 6-6" />
                </g>
              </svg>
            </div>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </template>
    <template #footer>
      <div class="command-palette-logo">
        <a
          href="https://github.com/xiaoluoboding/vue-command-palette"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="command-palette-Label">Search by</span>
          <Logo />
        </a>
      </div>
      <ul class="command-palette-commands">
        <li>
          <kbd class="command-palette-commands-key"><svg width="15" height="15" aria-label="Enter key" role="img">
            <g
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.2"
            >
              <path
                d="M12 3.53088v3c0 1-1 2-2 2H4M7 11.53088l-3-3 3-3"
              />
            </g></svg></kbd><span class="command-palette-Label">to select</span>
        </li>
        <li>
          <kbd class="command-palette-commands-key"><svg width="15" height="15" aria-label="Arrow down" role="img">
            <g
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.2"
            >
              <path d="M7.5 3.5v8M10.5 8.5l-3 3-3-3" />
            </g></svg></kbd><kbd class="command-palette-commands-key"><svg width="15" height="15" aria-label="Arrow up" role="img">
            <g
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.2"
            >
              <path d="M7.5 11.5v-8M10.5 6.5l-3-3-3 3" />
            </g></svg></kbd><span class="command-palette-Label">to navigate</span>
        </li>
        <li>
          <kbd class="command-palette-commands-key"><svg width="15" height="15" aria-label="Escape key" role="img">
            <g
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.2"
            >
              <path
                d="M13.6167 8.936c-.1065.3583-.6883.962-1.4875.962-.7993 0-1.653-.9165-1.653-2.1258v-.5678c0-1.2548.7896-2.1016 1.653-2.1016.8634 0 1.3601.4778 1.4875 1.0724M9 6c-.1352-.4735-.7506-.9219-1.46-.8972-.7092.0246-1.344.57-1.344 1.2166s.4198.8812 1.3445.9805C8.465 7.3992 8.968 7.9337 9 8.5c.032.5663-.454 1.398-1.4595 1.398C6.6593 9.898 6 9 5.963 8.4851m-1.4748.5368c-.2635.5941-.8099.876-1.5443.876s-1.7073-.6248-1.7073-2.204v-.4603c0-1.0416.721-2.131 1.7073-2.131.9864 0 1.6425 1.031 1.5443 2.2492h-2.956"
              />
            </g></svg></kbd><span class="command-palette-Label">to close</span>
        </li>
      </ul>
    </template>
  </Command.Dialog>
</template>
