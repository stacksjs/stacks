<script lang="ts" setup>
import { Command } from '../../../../packages'
import { isDark } from '../../../composables/useDarkmode'

import MoonIcon from '../../icons/MoonIcon.vue'
import SunIcon from '../../icons/SunIcon.vue'
import ContactIcon from '../../icons/VercelContactIcon.vue'
import DocsIcon from '../../icons/VercelDocsIcon.vue'
import FeedbackIcon from '../../icons/VercelFeedbackIcon.vue'
import PlusIcon from '../../icons/VercelPlusIcon.vue'
import ProjectsIcon from '../../icons/VercelProjectsIcon.vue'
import TeamsIcon from '../../icons/VercelTeamsIcon.vue'
import Item from './Item.vue'

const items1 = [
  {
    icon: ProjectsIcon,
    label: 'Search Projects...',
    shortcut: ['S', 'P'],
  },
  {
    icon: PlusIcon,
    label: 'Create New Project...',
  },
]

const items2 = [
  {
    icon: TeamsIcon,
    label: 'Search Team...',
    shortcut: ['⇧', 'P'],
  },
  {
    icon: PlusIcon,
    label: 'Create New Team...',
  },
]

const items3 = [
  {
    icon: DocsIcon,
    label: 'Search Docs...',
    shortcut: ['⇧', 'D'],
  },
  {
    icon: FeedbackIcon,
    label: 'Send Feedback...',
  },
  {
    icon: ContactIcon,
    label: 'Contact Support',
  },
]

const items4 = [
  {
    icon: SunIcon,
    label: 'Toggle Dark Mode',
    shortcut: ['G', 'T'],
  },
]
</script>

<template>
  <div>
    <Command.Group heading="Projects">
      <Item
        v-for="item in items1"
        :key="item.label"
        :shortcut="item.shortcut"
        :data-value="item.label"
      >
        <component :is="item.icon" />
        {{ item.label }}
      </Item>
    </Command.Group>
    <Command.Group heading="Teams">
      <Item
        v-for="item in items2"
        :key="item.label"
        :shortcut="item.shortcut"
        :data-value="item.label"
      >
        <component :is="item.icon" />
        {{ item.label }}
      </Item>
    </Command.Group>
    <Command.Group heading="Help">
      <Item
        v-for="item in items3"
        :key="item.label"
        :shortcut="item.shortcut"
        :data-value="item.label"
      >
        <component :is="item.icon" />
        {{ item.label }}
      </Item>
    </Command.Group>
    <Command.Group heading="Preference">
      <Item
        v-for="item in items4"
        :key="item.label"
        :shortcut="item.shortcut"
        :data-value="item.label"
      >
        <MoonIcon v-if="isDark" />
        <SunIcon v-else />
        {{ item.label }}
      </Item>
    </Command.Group>
  </div>
</template>
