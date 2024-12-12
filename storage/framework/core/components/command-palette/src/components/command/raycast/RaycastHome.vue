<script lang="ts" setup>
import { Command } from '../../../../packages'
import FigmaIcon from '../../icons/FigmaIcon.vue'
import LinearIcon from '../../icons/LinearIcon.vue'
import ClipboardIcon from '../../icons/RaycastClipboardIcon.vue'
import HammerIcon from '../../icons/RaycastHammerIcon.vue'
import RaycastIcon from '../../icons/RaycastIcon.vue'
import SlackIcon from '../../icons/SlackIcon.vue'

import YouTubeIcon from '../../icons/YouTubeIcon.vue'
import Item from './RaycastItem.vue'

const items1 = [
  {
    icon: LinearIcon,
    label: 'Linear',
    isCommand: false,
  },
  {
    icon: FigmaIcon,
    label: 'Figma',
    isCommand: false,
  },
  {
    icon: SlackIcon,
    label: 'Slack',
    isCommand: false,
  },
  {
    icon: YouTubeIcon,
    label: 'YouTube',
    isCommand: false,
  },
  {
    icon: RaycastIcon,
    label: 'Raycast',
    isCommand: false,
  },
]

const items2 = [
  {
    icon: ClipboardIcon,
    label: 'Clipboard History',
    isCommand: true,
  },
  {
    icon: HammerIcon,
    label: 'Import Extension',
    isCommand: true,
  },
  {
    icon: HammerIcon,
    label: 'Manage Extensions',
    isCommand: true,
  },
]
</script>

<template>
  <Command.Group heading="Suggestions">
    <Item
      v-for="item in items1"
      :key="item.label"
      :is-command="item.isCommand"
      :data-value="item.label"
    >
      <div class="icon_blur-logo">
        <div class="icon_bg" />
        <div class="icon_inner">
          <component :is="item.icon" />
        </div>
      </div>
      {{ item.label }}
    </Item>
  </Command.Group>
  <Command.Group heading="Commands">
    <Item
      v-for="item in items2"
      :key="item.label"
      :is-command="item.isCommand"
      :data-value="item.label"
    >
      <component :is="item.icon" />
      {{ item.label }}
    </Item>
  </Command.Group>
</template>

<style scoped>
.icon_blur-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 0 1px 1px rgb(0 0 0 / 2%);
  width: 20px;
  height: 20px;
}
.icon_inner,
.icon_bg {
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  user-select: none;
  width: 100%;
  height: 100%;
}

.icon_inner svg {
  filter: drop-shadow(0 4px 4px rgba(0, 0, 0, 0.16));
  transition: filter 0.15s ease;
  height: 14px;
  width: 14px;
}
</style>
