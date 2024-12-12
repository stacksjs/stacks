<script lang="ts" setup>
import { Command } from '../../../packages'
import LinearAssignToIcon from '../icons/LinearAssignToIcon.vue'
import LinearAssignToMeIcon from '../icons/LinearAssignToMeIcon.vue'
import LinearChangeLabelsIcon from '../icons/LinearChangeLabelsIcon.vue'
import LinearChangePriorityIcon from '../icons/LinearChangePriorityIcon.vue'
import LinearChangeStatusIcon from '../icons/LinearChangeStatusIcon.vue'
import LinearRemoveLabelIcon from '../icons/LinearRemoveLabelIcon.vue'
import LinearSetDueDateIcon from '../icons/LinearSetDueDateIcon.vue'

const items = [
  {
    icon: LinearAssignToIcon,
    label: 'Assign to...',
    shortcut: ['A'],
    perform: () => {
      console.log('action')
    },
  },
  {
    icon: LinearAssignToMeIcon,
    label: 'Assign to me',
    shortcut: ['I'],
  },
  {
    icon: LinearChangeStatusIcon,
    label: 'Change status...',
    shortcut: ['S'],
  },
  {
    icon: LinearChangePriorityIcon,
    label: 'Change priority...',
    shortcut: ['P'],
  },
  {
    icon: LinearChangeLabelsIcon,
    label: 'Change labels...',
    shortcut: ['L'],
  },
  {
    icon: LinearRemoveLabelIcon,
    label: 'Remove label...',
    shortcut: ['⇧', 'L'],
  },
  {
    icon: LinearSetDueDateIcon,
    label: 'Set due date...',
    shortcut: ['⇧', 'D'],
  },
]

function handleSelectItem(item: any) {
  console.log(item)
}
</script>

<template>
  <Command.Dialog :visible="true" theme="linear">
    <template #header>
      <div command-linear-badge="">
        Issue - FUN-343
      </div>
      <Command.Input placeholder="Type a command or search..." />
    </template>
    <template #body>
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        <Command.Item
          v-for="item in items"
          :data-value="item.label"
          :shortcut="item.shortcut"
          :perform="item.perform"
          @select="handleSelectItem"
        >
          <component :is="item.icon" />
          <div>{{ item.label }}</div>
          <div command-linear-shortcuts>
            <kbd v-for="key in item.shortcut" key="key">{{ key }}</kbd>
          </div>
        </Command.Item>
      </Command.List>
    </template>
  </Command.Dialog>
</template>
