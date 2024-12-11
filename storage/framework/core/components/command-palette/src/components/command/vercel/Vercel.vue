<script lang="ts" setup>
import type { ItemInfo } from '../../../../packages/types'
import { useMagicKeys, whenever } from '@vueuse/core'

import { computed, ref } from 'vue'
import { Command, useCommandState } from '../../../../packages'
import { toggleDarkmode } from '../../../composables/useDarkmode'
import Home from './Home.vue'
import Projects from './Projects.vue'

const { current } = useMagicKeys()
const { search } = useCommandState()

const activePage = ref('home')
const inputValue = ref('')

const isHomePage = computed(() => activePage.value === 'home')

const currentView = computed(() => {
  return isHomePage.value ? Home : Projects
})

const pageTree = computed(() => {
  let pages = ['Home']
  if (isHomePage.value)
    pages = ['Home']
  else
    pages.push(activePage.value)

  return pages
})

function togglePage() {
  activePage.value = isHomePage.value ? 'projects' : 'home'
  search.value = ''
}

function handleKeyDown() {
  if (isHomePage.value || inputValue.value.length)
    return

  togglePage()
}

whenever(() => current.has('backspace'), handleKeyDown)

function handleSelectItem(item: ItemInfo) {
  if (item.value === 'Search Projects...')
    togglePage()

  if (item.value === 'Toggle Dark Mode')
    toggleDarkmode()
}
</script>

<template>
  <Command.Dialog
    :visible="true"
    theme="vercel"
    @select-item="handleSelectItem"
  >
    <template #header>
      <div command-vercel-label>
        <label v-for="page in pageTree" command-vercel-badge>
          {{ page }}
        </label>
      </div>
      <Command.Input
        v-model:value="inputValue"
        placeholder="What do you need?"
      />
    </template>

    <template #body>
      <Command.List ref="dialogRef">
        <Command.Empty>No results found.</Command.Empty>
        <Transition name="pop-page">
          <KeepAlive>
            <component :is="currentView" :key="activePage" />
          </KeepAlive>
        </Transition>
      </Command.List>
    </template>
  </Command.Dialog>
</template>

<style scoped>

</style>
