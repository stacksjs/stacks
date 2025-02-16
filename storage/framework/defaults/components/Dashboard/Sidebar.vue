<script setup lang="ts">
import { ref } from 'vue'

const calculateTransform = (section: string) => {
  if (!draggedItem || !isDragging.value) return ''

  // Only the dragged item gets a small horizontal offset
  if (section === draggedItem) {
    return 'translate3d(4px, 0, 0)'
  }

  // Only the currently hovered item moves
  if (section === dragTarget.value) {
    return 'translate3d(0, -48px, 0)'
  }

  return ''
}

// State for each section's collapse status
const sections = ref({
  library: true,
  app: true,
  models: true,
  management: true
})

// Create an ordered array of sections that we can reorder
const sectionOrder = ref(['library', 'app', 'models', 'management'])

// Toggle function for sections
const toggleSection = (section: keyof typeof sections.value) => {
  sections.value[section] = !sections.value[section]
}

// Drag and drop handling
let draggedItem: string | null = null
const draggedIndex = ref<number | null>(null)
const dragStartY = ref(0)
const dragOffset = ref(0)
const isDragging = ref(false)
const dragTarget = ref<string | null>(null)

const handleDragStart = (section: string, event: DragEvent) => {
  if (event.dataTransfer) {
    draggedItem = section
    isDragging.value = true
    draggedIndex.value = sectionOrder.value.indexOf(section)
    dragStartY.value = event.clientY

    // Set drag image to be transparent
    const dragImage = document.createElement('div')
    dragImage.style.opacity = '0'
    document.body.appendChild(dragImage)
    event.dataTransfer.setDragImage(dragImage, 0, 0)
    setTimeout(() => document.body.removeChild(dragImage), 0)

    // Add dragging class to body for global styles
    document.body.classList.add('is-dragging')
  }
}

const handleDragOver = (section: string, event: DragEvent) => {
  event.preventDefault()

  if (!draggedItem || draggedItem === section) return

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const offsetY = event.clientY - dragStartY.value
  dragOffset.value = offsetY

  // Calculate position within the dragged-over item
  const relativeY = event.clientY - rect.top
  const threshold = rect.height / 2

  if (relativeY < threshold) {
    updateOrder(section, 'before')
  } else {
    updateOrder(section, 'after')
  }
}

const updateOrder = (targetSection: string, position: 'before' | 'after') => {
  if (!draggedItem) return

  const newOrder = [...sectionOrder.value]
  const currentIndex = newOrder.indexOf(draggedItem)
  const targetIndex = newOrder.indexOf(targetSection)

  newOrder.splice(currentIndex, 1)
  const insertAt = position === 'before' ? targetIndex : targetIndex + 1
  newOrder.splice(insertAt, 0, draggedItem)

  // Only update if order changed
  if (JSON.stringify(newOrder) !== JSON.stringify(sectionOrder.value)) {
    sectionOrder.value = newOrder
    draggedIndex.value = insertAt
  }
}

const handleDragEnd = () => {
  isDragging.value = false
  dragOffset.value = 0
  draggedItem = null
  document.body.classList.remove('is-dragging')
}

// Section content mapping
const sectionContent = {
  library: {
    items: [
      { to: '/components', icon: 'i-hugeicons-puzzle', text: 'Components' },
      { to: '/functions', icon: 'i-hugeicons-function-square', text: 'Functions' },
      { to: '/releases', icon: 'i-hugeicons-right-to-left-list-number', text: 'Releases' },
      { to: '/packages', icon: 'i-hugeicons-package', text: 'Packages' }
    ]
  },
  app: {
    items: [
      { to: '/deployments', icon: 'i-hugeicons-rocket', text: 'Deployments' },
      { to: '/requests', icon: 'i-hugeicons-api', text: 'Requests' },
      { to: '/actions', icon: 'i-hugeicons-function-of-x', text: 'Actions' },
      { to: '/commands', icon: 'i-hugeicons-command-line', text: 'Commands' },
      { to: '/jobs', icon: 'i-hugeicons-queue-02', text: 'Jobs' },
      { to: '/notifications', icon: 'i-hugeicons-notification-square', text: 'Notifications' }
    ]
  },
  models: {
    items: [
      { to: '/models/users', letter: 'U', text: 'Users' },
      { to: '/models/teams', letter: 'T', text: 'Teams' },
      { to: '/models/subscribers', letter: 'S', text: 'Subscribers' }
    ]
  },
  management: {
    items: [
      { to: '/dns', icon: 'i-hugeicons-global-search', text: 'DNS' },
      { to: '/emails', icon: 'i-hugeicons-at', text: 'Emails' },
      { to: '/logs', icon: 'i-hugeicons-search-list-01', text: 'Logs' }
    ]
  }
}
</script>

<template>
  <div>
    <!-- Static sidebar for desktop -->
    <div class="hidden lg:fixed lg:inset-y-0 lg:w-64 lg:flex lg:flex-col">
      <div class="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4 dark:border-gray-600 dark:bg-blue-gray-900">
        <div class="pt-4 h-12 flex shrink-0 items-center justify-between rounded-lg">
          <RouterLink to="/">
            <img class="h-12 w-auto rounded-lg cursor-pointer" src="/images/logos/logo.svg" alt="Stacks Logo">
          </RouterLink>
          <div class="i-hugeicons-more-horizontal h-6 w-6 cursor-pointer text-gray-700 transition duration-150 ease-in-out hover:bg-gray-900 dark:text-gray-200 group-hover:text-gray-700 dark:hover:bg-blue-gray-100" />
        </div>

        <nav class="flex flex-1 flex-col">
          <ul role="list" class="flex flex-1 flex-col gap-y-8">
            <!-- Dashboard section -->
            <li>
              <ul role="list" class="mt-2 -mx-2 space-y-1">
                <li>
                  <RouterLink to="/" class="group sidebar-links">
                    <div class="i-hugeicons-home-03 h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700 mt-0.5" />
                    Dashboard
                  </RouterLink>
                </li>
              </ul>
            </li>

            <!-- Draggable sections -->
            <template v-for="sectionKey in sectionOrder" :key="sectionKey">
              <li
                draggable="true"
                :style="{
                  transform: calculateTransform(sectionKey),
                  transition: dragTarget?.value && dragTarget.value === sectionKey ? 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                  position: 'relative',
                  zIndex: draggedItem === sectionKey ? 20 : 10
                }"
                :class="{
                  'opacity-50': isDragging && draggedItem === sectionKey,
                  'cursor-grabbing': isDragging,
                  'cursor-grab': !isDragging
                }"
                @dragstart="handleDragStart(sectionKey, $event)"
                @dragover="handleDragOver(sectionKey, $event)"
                @dragend="handleDragEnd"
              >
                <!-- Section header -->
                <div
                  class="flex items-center justify-between cursor-pointer"
                  @click="toggleSection(sectionKey)"
                >
                  <div class="flex items-center gap-2">
                    <div
                      class="i-hugeicons-drag-drop-horizontal h-4 w-4 text-gray-400 cursor-move drag-handle"
                      @mousedown.stop
                      @click.stop
                    />
                    <div class="text-xs text-gray-400 font-semibold leading-6">
                      {{ sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1) }}
                    </div>
                  </div>

                  <div
                    :class="[
                      'i-hugeicons-arrow-down-01 h-4 w-4 text-gray-300 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700',
                      { 'transform -rotate-90': !sections[sectionKey] }
                    ]"
                  />
                </div>

                <!-- Section content -->
                <ul
                  role="list"
                  class="mt-2 -mx-2 space-y-1 section-content"
                  :class="sections[sectionKey] ? 'expanded' : 'collapsed'"
                >
                  <li v-for="item in sectionContent[sectionKey].items" :key="item.to">
                    <RouterLink :to="item.to" class="sidebar-links group">
                      <template v-if="item.icon">
                        <div :class="[item.icon, 'h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700 mt-0.5']" />
                      </template>
                      <template v-else-if="item.letter">
                        <span class="h-6 w-6 flex shrink-0 items-center justify-center border border-gray-200 rounded-lg bg-white text-[0.625rem] text-gray-400 font-medium dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">
                          {{ item.letter }}
                        </span>
                      </template>
                      <span class="truncate">{{ item.text }}</span>
                    </RouterLink>
                  </li>
                </ul>
              </li>
            </template>

            <!-- Bottom section -->
            <li class="mt-auto flex items-center justify-between space-x-4">
              <div class="flex items-center">
                <RouterLink
                  to="/buddy"
                  class="sidebar-bottom-link"
                  :class="{ 'active-bottom-link': $route.path === '/buddy' }"
                >
                  <div class="i-hugeicons-ai-chat-02 h-5 w-5 text-gray-500 transition-all duration-150 ease-in-out dark:text-gray-200 group-hover:text-blue-600" />
                </RouterLink>

                <RouterLink
                  to="/environment"
                  class="sidebar-bottom-link"
                  :class="{ 'active-bottom-link': $route.path === '/environment' }"
                >
                  <div class="i-hugeicons-key-01 h-5 w-5 text-gray-500 transition-all duration-150 ease-in-out dark:text-gray-200 group-hover:text-blue-600" />
                </RouterLink>

                <RouterLink
                  to="/access-tokens"
                  class="sidebar-bottom-link"
                  :class="{ 'active-bottom-link': $route.path === '/access-tokens' }"
                >
                  <div class="i-hugeicons-api h-5 w-5 text-gray-500 transition-all duration-150 ease-in-out dark:text-gray-200 group-hover:text-blue-600" />
                </RouterLink>

                <RouterLink
                  to="/settings/ai"
                  class="sidebar-bottom-link"
                  :class="{ 'active-bottom-link': $route.path.startsWith('/settings/ai') }"
                >
                  <div class="i-hugeicons-settings-02 h-5 w-5 text-gray-500 transition-all duration-150 ease-in-out dark:text-gray-200 group-hover:text-blue-600" />
                </RouterLink>
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-links {
  @apply text-blue-gray-600 dark:text-blue-gray-200 hover:text-blue-gray-800 duration-150 ease-in-out transition flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold;
}

.router-link-active {
  @apply bg-blue-gray-50 text-blue-600 dark:bg-gray-700 dark:text-blue-400;
}

.router-link-active div[class^="i-hugeicons"] {
  @apply text-blue-600 dark:text-blue-400;
}

.router-link-active span.h-6 {
  @apply border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400;
}

.sidebar-bottom-link {
  @apply flex items-center justify-center px-3 py-3 text-sm font-semibold leading-6
         transition-all duration-150 ease-in-out rounded-lg
         hover:bg-blue-gray-50 dark:hover:bg-gray-700;
}

.sidebar-bottom-link div {
  @apply group-hover:text-blue-600 dark:group-hover:text-blue-400;
}

.active-bottom-link {
  @apply bg-blue-gray-50 dark:bg-gray-700;
}

.active-bottom-link div {
  @apply text-blue-600 dark:text-blue-400 !important;
}

.section-content {
  @apply overflow-hidden transition-all duration-300 ease-in-out;
}

.collapsed {
  @apply max-h-0;
}

.expanded {
  @apply max-h-96;
}

li[draggable="true"] {
  @apply touch-none select-none;
  will-change: transform;
}

/* Add smooth transition for non-dragged items */
li[draggable="true"]:not(.dragging) {
  @apply transition-transform;
}

/* Remove transition during drag */
:global(body.is-dragging) li[draggable="true"] {
  transition-duration: 200ms;
}

/* Update drag handle styles */
.drag-handle {
  @apply opacity-0 transition-opacity duration-200 cursor-grab;
}

li[draggable="true"]:hover .drag-handle {
  @apply opacity-100;
}

li[draggable="true"].dragging .drag-handle {
  @apply cursor-grabbing;
}
</style>
