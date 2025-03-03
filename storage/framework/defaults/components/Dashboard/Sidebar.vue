<script setup lang="ts">
import { ref } from 'vue'
import { onClickOutside, useLocalStorage } from '@vueuse/core'

// Add Team interface
interface Team {
  id: number
  name: string
  email: string
  type: 'Personal' | 'Professional'
}

interface SidebarItem {
  to: string
  icon?: string
  letter?: string
  text: string
  children?: SidebarItem[]
}

interface SectionContent {
  items: SidebarItem[]
}

interface Sections {
  [key: string]: boolean
}

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
const sections = useLocalStorage<Sections>('sidebar-sections', {
  library: true,
  app: true,
  data: true,
  commerce: true,
  management: true
})

// Add separate state for nested items
const expandedItems = useLocalStorage<Record<string, boolean>>('sidebar-expanded-items', {
  '/cloud': false,
  '#queue': false,
  '#commerce': false
})

// Create an ordered array of sections that we can reorder
const sectionOrder = useLocalStorage<string[]>('sidebar-section-order', ['library', 'app', 'data', 'commerce', 'management'])

// Toggle function for sections
const toggleSection = (section: string) => {
  sections.value[section] = !sections.value[section]
}

const toggleItem = (path: string) => {
  expandedItems.value[path] = !expandedItems.value[path]
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
const sectionContent: Record<string, SectionContent> = {
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
      { to: '/realtime', icon: 'i-hugeicons-link-03', text: 'Realtime' },
      { to: '/actions', icon: 'i-hugeicons-function-of-x', text: 'Actions' },
      { to: '/commands', icon: 'i-hugeicons-command-line', text: 'Commands' },
      {
        to: '#queue',
        icon: 'i-hugeicons-queue-02',
        text: 'Queue',
        children: [
          { to: '/queue', icon: 'i-hugeicons-dashboard-speed-01', text: 'Dashboard' },
          { to: '/jobs', icon: 'i-hugeicons-briefcase-01', text: 'Jobs' }
        ]
      },
      { to: '/notifications', icon: 'i-hugeicons-notification-square', text: 'Notifications' }
    ]
  },
  commerce: {
    items: [
      { to: '/commerce', icon: 'i-hugeicons-dashboard-speed-01', text: 'Dashboard' },
      { to: '/commerce/products', icon: 'i-hugeicons-package', text: 'Products' },
      { to: '/commerce/categories', icon: 'i-hugeicons-tags', text: 'Categories' },
      { to: '/commerce/manufacturers', icon: 'i-hugeicons-factory', text: 'Manufacturers' },
      { to: '/commerce/variants', icon: 'i-hugeicons-paint-board', text: 'Variants' },
      { to: '/commerce/units', icon: 'i-hugeicons-ruler', text: 'Units' },
      { to: '/commerce/taxes', icon: 'i-hugeicons-taxes', text: 'Taxes' },
      { to: '/commerce/orders', icon: 'i-hugeicons-search-list-01', text: 'Orders' },
      { to: '/commerce/customers', icon: 'i-hugeicons-user-account', text: 'Customers' },
      { to: '/commerce/coupons', icon: 'i-hugeicons-coupon-01', text: 'Coupons' },
      { to: '/commerce/gift-cards', icon: 'i-hugeicons-gift-card', text: 'Gift Cards' },
      { to: '/commerce/payments', icon: 'i-hugeicons-invoice-01', text: 'Payments' },
      { to: '/commerce/shipping', icon: 'i-hugeicons-shipping-truck-01', text: 'Delivery' },
      { to: '/commerce/analytics', icon: 'i-hugeicons-analytics-01', text: 'Analytics' }
    ]
  },
  data: {
    items: [
      { to: '/models', icon: 'i-hugeicons-dashboard-speed-01', text: 'Dashboard' },
      { to: '/models/users', letter: 'U', text: 'Users' },
      { to: '/models/teams', letter: 'T', text: 'Teams' },
      { to: '/models/subscribers', letter: 'S', text: 'Subscribers' }
    ]
  },
  management: {
    items: [
      {
        to: '/cloud',
        icon: 'i-hugeicons-cloud',
        text: 'Cloud',
        children: [
          { to: '/servers', icon: 'i-hugeicons-cloud-server', text: 'Servers' },
          { to: '/serverless', icon: 'i-hugeicons-cloud-angled-zap', text: 'Serverless' },
        ]
      },
      { to: '/dns', icon: 'i-hugeicons-global-search', text: 'DNS' },
      { to: '/mailboxes', icon: 'i-hugeicons-mailbox-01', text: 'Mailboxes' },
      { to: '/logs', icon: 'i-hugeicons-search-list-01', text: 'Logs' }
    ]
  }
}

// Add team switcher state
const showTeamSwitcher = ref(false)
const teamSwitcherRef = ref<HTMLElement | null>(null)

// Close team switcher when clicking outside
onClickOutside(teamSwitcherRef, () => {
  showTeamSwitcher.value = false
})

// Mock teams data with proper typing
const teams = ref<Team[]>([
  { id: 1, name: 'Stacks.js', email: 'chris@stacksjs.org', type: 'Personal' },
  { id: 2, name: 'Jetbrains', email: 'support@jetbrains.com', type: 'Professional' }
])

const currentTeam = ref<Team>(teams.value[0] ?? {
  id: 1,
  name: 'Stacks.js',
  email: 'chris@stacksjs.org',
  type: 'Personal'
})

const switchTeam = (team: Team) => {
  currentTeam.value = team
  showTeamSwitcher.value = false
  // Add your team switching logic here
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

          <!-- Team Switcher -->
          <div class="relative" ref="teamSwitcherRef">
            <button
              type="button"
              class="block p-2 text-gray-400 hover:text-gray-500 focus:outline-none"
              @click="showTeamSwitcher = !showTeamSwitcher"
            >
              <div class="i-hugeicons-more-horizontal-circle-01 h-6 w-6 cursor-pointer text-gray-400 transition duration-150 ease-in-out hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100" />
            </button>

            <!-- Team Switcher Dropdown -->
            <div
              v-if="showTeamSwitcher"
              class="absolute right-0 z-10 mt-2 w-72 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none dark:bg-blue-gray-800 dark:ring-gray-700"
              role="menu"
              aria-orientation="vertical"
              tabindex="-1"
            >
              <div class="px-4 py-2">
                <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">Switch Team</h3>
              </div>

              <div class="border-t border-gray-100 dark:border-gray-700">
                <div class="max-h-96 overflow-y-auto py-2">
                  <button
                    v-for="team in teams"
                    :key="team.id"
                    class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-blue-gray-700"
                    :class="{ 'bg-gray-50 dark:bg-blue-gray-700': currentTeam.id === team.id }"
                    @click="switchTeam(team)"
                  >
                    <div class="flex items-center">
                      <div class="h-8 w-8 flex-shrink-0">
                        <img
                          src="https://avatars.githubusercontent.com/u/6228425?v=4"
                          alt=""
                          class="h-8 w-8 rounded-full"
                        >
                      </div>
                      <div class="ml-4">
                        <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ team.name }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ team.email }}</p>
                      </div>
                      <div
                        v-if="currentTeam.id === team.id"
                        class="ml-auto"
                      >
                        <div class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div class="border-t border-gray-100 dark:border-gray-700 px-4 py-2">
                <RouterLink
                  to="/models/teams"
                  class="block w-full rounded-md px-3 py-2 text-center text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors duration-150"
                  @click="showTeamSwitcher = false"
                >
                  Manage Teams
                </RouterLink>
              </div>
            </div>
          </div>
        </div>

        <nav class="flex flex-1 flex-col">
          <ul role="list" class="flex flex-1 flex-col gap-y-8">
            <!-- Dashboard section -->
            <li>
              <ul role="list" class="mt-2 -mx-2 space-y-1">
                <li>
                  <RouterLink to="/" class="group sidebar-links">
                    <div class="i-hugeicons-home-05 h-5 w-5 text-gray-400 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700 mt-0.5" />
                    Home
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
                  transition: dragTarget && dragTarget === sectionKey ? 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
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
                  <div class="flex items-center gap-2 -ml-3">
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
                  <li v-for="item in sectionContent[sectionKey]?.items || []" :key="item.to">
                    <div>
                      <RouterLink
                        :to="item.to"
                        class="sidebar-links group relative"
                        :class="{ 'no-active': item.to.startsWith('#') }"
                        @click.prevent="item.children ? toggleItem(item.to) : $router.push(item.to)"
                      >
                        <template v-if="item.icon">
                          <div :class="[item.icon, 'h-5 w-5 text-gray-400 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700 mt-0.5']" />
                        </template>
                        <template v-else-if="item.letter">
                          <span class="h-6 w-6 flex shrink-0 items-center justify-center border border-gray-200 rounded-lg bg-white text-[0.625rem] text-gray-400 font-medium dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">
                            {{ item.letter }}
                          </span>
                        </template>
                        <div class="flex items-center justify-between flex-1">
                          <span class="truncate" :class="{ 'ml-[4px]': item.icon }">{{ item.text }}</span>
                          <div
                            v-if="item.children"
                            class="i-heroicons-chevron-right h-4 w-4 text-gray-300 transition-transform duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700"
                            :class="{ 'transform rotate-90': expandedItems[item.to] }"
                          />
                        </div>
                      </RouterLink>

                      <!-- Use transition for all dropdowns -->
                      <transition name="dropdown">
                        <ul
                          v-if="item.children && expandedItems[item.to]"
                          role="list"
                          class="mt-1 space-y-1 dropdown-list"
                          :style="{ 'max-height': '100px' }"
                        >
                          <li v-for="child in item.children" :key="child.to" class="dropdown-item">
                            <RouterLink :to="child.to" class="sidebar-child-link group">
                              <div :class="[child.icon, 'h-5 w-5 text-gray-400 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700 mt-0.5']" />
                              <span class="truncate">{{ child.text }}</span>
                            </RouterLink>
                          </li>
                        </ul>
                      </transition>
                    </div>
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
                  <div class="i-hugeicons-ai-chat-02 h-5 w-5 text-gray-400 transition-all duration-150 ease-in-out dark:text-gray-200 group-hover:text-blue-600" />
                </RouterLink>

                <RouterLink
                  to="/environment"
                  class="sidebar-bottom-link"
                  :class="{ 'active-bottom-link': $route.path === '/environment' }"
                >
                  <div class="i-hugeicons-key-01 h-5 w-5 text-gray-400 transition-all duration-150 ease-in-out dark:text-gray-200 group-hover:text-blue-600" />
                </RouterLink>

                <RouterLink
                  to="/access-tokens"
                  class="sidebar-bottom-link"
                  :class="{ 'active-bottom-link': $route.path === '/access-tokens' }"
                >
                  <div class="i-hugeicons-shield-key h-5 w-5 text-gray-400 transition-all duration-150 ease-in-out dark:text-gray-200 group-hover:text-blue-600" />
                </RouterLink>

                <RouterLink
                  to="/settings/ai"
                  class="sidebar-bottom-link"
                  :class="{ 'active-bottom-link': $route.path.startsWith('/settings/ai') }"
                >
                  <div class="i-hugeicons-settings-02 h-5 w-5 text-gray-400 transition-all duration-150 ease-in-out dark:text-gray-200 group-hover:text-blue-600" />
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
  @apply text-blue-gray-600 dark:text-blue-gray-200 hover:text-blue-gray-800
         duration-150 ease-in-out transition flex items-center gap-x-3
         rounded-md p-2 text-sm leading-6 font-semibold;
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

.sidebar-child-link {
  @apply text-blue-gray-600 dark:text-blue-gray-200 hover:text-blue-gray-800
         duration-150 ease-in-out transition flex items-center gap-x-3
         rounded-md p-2 text-sm leading-6 font-semibold pl-8;
}

.router-link-active.sidebar-child-link {
  @apply bg-blue-gray-50 text-blue-600 dark:bg-gray-700 dark:text-blue-400;
}

.no-active {
  @apply !bg-transparent !text-blue-gray-600 dark:!text-blue-gray-200;
}

.no-active div[class^="i-hugeicons"] {
  @apply !text-gray-400 dark:!text-gray-200;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.3s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  max-height: 0 !important;
}

.dropdown-list {
  overflow-y: auto;
}

.dropdown-item {
  height: 40px;
}
</style>
