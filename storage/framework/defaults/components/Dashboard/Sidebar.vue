<script setup lang="ts">
// Add Team interface
import Tooltip from './Tooltip.vue'
import { useDark } from '@vueuse/core'

interface Team {
  id: number
  name: string
  email: string
  type: 'Personal' | 'Professional'
  logo?: string
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

const route = useRoute()
const router = useRouter()
const isDark = useDark()

// Add sidebar collapsed state
const isSidebarCollapsed = useLocalStorage('sidebar-collapsed', false)

// Toggle sidebar function
const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
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
  content: true,
  app: true,
  data: true,
  commerce: true,
  marketing: true,
  management: true,
  analytics: true
})

// Add separate state for nested items
const expandedItems = useLocalStorage<Record<string, boolean>>('sidebar-expanded-items', {
  '/cloud': false,
  '#queue': false,
  '#queries': false,
  '#commerce': false,
  '#commerce-products': false,
  '#commerce-analytics': false,
  '#social-posts': false,
  '#analytics': false,
  '#analytics-web': false,
  '#waitlist': false,
  '#notifications': false
})

// Create an ordered array of sections that we can reorder
const sectionOrder = useLocalStorage<string[]>('sidebar-section-order', ['library', 'content', 'app', 'data', 'commerce', 'marketing', 'analytics', 'management'])

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
  content: {
    items: [
      { to: '/content/dashboard', icon: 'i-hugeicons-dashboard-speed-01', text: 'Dashboard' },
      { to: '/content/files', icon: 'i-hugeicons-apple-finder', text: 'Files' },
      { to: '/content/pages', icon: 'i-hugeicons-file-02', text: 'Pages' },
      { to: '/content/posts', icon: 'i-hugeicons-message-edit-02', text: 'Posts' },
      { to: '/content/categories', icon: 'i-hugeicons-tags', text: 'Categories' },
      { to: '/content/tags', icon: 'i-hugeicons-tag-01', text: 'Tags' },
      { to: '/content/comments', icon: 'i-hugeicons-comment-01', text: 'Comments' },
      { to: '/content/authors', icon: 'i-hugeicons-user-edit-01', text: 'Authors' },
      { to: '/content/seo', icon: 'i-hugeicons-seo', text: 'SEO' }
    ]
  },
  app: {
    items: [
      { to: '/deployments', icon: 'i-hugeicons-rocket-01', text: 'Deployments' },
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
      {
        to: '#queries',
        icon: 'i-hugeicons-search-area',
        text: 'Queries',
        children: [
          { to: '/queries', icon: 'i-hugeicons-dashboard-speed-01', text: 'Dashboard' },
          { to: '/queries/history', icon: 'i-hugeicons-search-list-01', text: 'History' },
          { to: '/queries/slow', icon: 'i-hugeicons-snail', text: 'Slow Queries' }
        ]
      },
      {
        to: '#notifications',
        icon: 'i-hugeicons-notification-square',
        text: 'Notifications',
        children: [
          { to: '/notifications/dashboard', icon: 'i-hugeicons-dashboard-speed-01', text: 'Dashboard' },
          { to: '/notifications/history', icon: 'i-hugeicons-notification-03', text: 'History' },
          { to: '/notifications/sms', icon: 'i-hugeicons-smart-phone-01', text: 'SMS' },
          { to: '/notifications/email', icon: 'i-hugeicons-mail-01', text: 'Email' }
        ]
      }
    ]
  },
  commerce: {
    items: [
      { to: '/commerce/dashboard', icon: 'i-hugeicons-dashboard-speed-01', text: 'Dashboard' },
      { to: '/commerce/pos', icon: 'i-hugeicons-shopping-cart-02', text: 'POS' },
      { to: '/commerce/customers', icon: 'i-hugeicons-user-account', text: 'Customers' },
      { to: '/commerce/orders', icon: 'i-hugeicons-search-list-01', text: 'Orders' },
      {
        to: '#commerce-products',
        icon: 'i-hugeicons-package',
        text: 'Products',
        children: [
          { to: '/commerce/products', icon: 'i-hugeicons-package', text: 'Items' },
          { to: '/commerce/categories', icon: 'i-hugeicons-tags', text: 'Categories' },
          { to: '/commerce/variants', icon: 'i-hugeicons-paint-board', text: 'Variants' },
          { to: '/commerce/units', icon: 'i-hugeicons-ruler', text: 'Units' },
          { to: '/commerce/manufacturers', icon: 'i-hugeicons-factory', text: 'Manufacturers' },
          { to: '/commerce/reviews', icon: 'i-hugeicons-star', text: 'Reviews' }
        ]
      },
      { to: '/commerce/coupons', icon: 'i-hugeicons-coupon-01', text: 'Coupons' },
      { to: '/commerce/gift-cards', icon: 'i-hugeicons-gift-card', text: 'Gift Cards' },
      { to: '/commerce/payments', icon: 'i-hugeicons-invoice-01', text: 'Payments' },
      { to: '/commerce/delivery', icon: 'i-hugeicons-shipping-truck-01', text: 'Delivery' },
      {
        to: '#waitlist',
        icon: 'i-hugeicons-hourglass',
        text: 'Waitlist',
        children: [
          { to: '/commerce/waitlist/products', icon: 'i-hugeicons-package', text: 'Products' },
          { to: '/commerce/waitlist/restaurant', icon: 'i-hugeicons-restaurant-01', text: 'Restaurant' }
        ]
      },
      { to: '/commerce/taxes', icon: 'i-hugeicons-taxes', text: 'Taxes' },
      {
        to: '#printers',
        icon: 'i-hugeicons-printer',
        text: 'Printers',
        children: [
          { to: '/commerce/printers/devices', icon: 'i-hugeicons-printer', text: 'Devices' },
          { to: '/commerce/printers/receipts', icon: 'i-hugeicons-file-02', text: 'Receipts' }
        ]
      }
    ]
  },
  data: {
    items: [
      { to: '/data/dashboard', icon: 'i-hugeicons-dashboard-speed-01', text: 'Dashboard' },
      { to: '/data/activity', icon: 'i-hugeicons-activity-01', text: 'Activity' },
      { to: '/data/users', letter: 'U', text: 'Users' },
      { to: '/data/teams', letter: 'T', text: 'Teams' },
      { to: '/data/subscribers', letter: 'S', text: 'Subscribers' }
    ]
  },
  marketing: {
    items: [
      // { to: '/marketing/dashboard', icon: 'i-hugeicons-dashboard-speed-01', text: 'Dashboard' },
      { to: '/marketing/lists', icon: 'i-hugeicons-list-setting', text: 'Lists' },
      { to: '/marketing/social-posts', icon: 'i-hugeicons-time-schedule', text: 'Social Posts' },
      { to: '/marketing/campaigns', icon: 'i-hugeicons-rocket-01', text: 'Campaigns' },
      { to: '/marketing/reviews', icon: 'i-hugeicons-star', text: 'Reviews' },
    ]
  },
  analytics: {
    items: [
      {
        to: '#analytics-web',
        icon: 'i-hugeicons-global',
        text: 'Web',
        children: [
          { to: '/analytics/web', icon: 'i-hugeicons-dashboard-speed-01', text: 'Overview' },
          { to: '/analytics/pages', icon: 'i-hugeicons-files-01', text: 'Pages' },
          { to: '/analytics/referrers', icon: 'i-hugeicons-link-03', text: 'Referrers' },
          { to: '/analytics/devices', icon: 'i-hugeicons-computer-phone-sync', text: 'Devices' },
          { to: '/analytics/browsers', icon: 'i-hugeicons-browser', text: 'Browsers' },
          { to: '/analytics/countries', icon: 'i-hugeicons-global', text: 'Countries' }
        ]
      },
      { to: '/analytics/blog', icon: 'i-hugeicons-document-validation', text: 'Blog' },
      { to: '/analytics/events', icon: 'i-hugeicons-target-01', text: 'Goals' },
      { to: '/analytics/commerce/web', icon: 'i-hugeicons-shopping-cart-02', text: 'Commerce' },
      { to: '/analytics/commerce/sales', icon: 'i-hugeicons-sale-tag-01', text: 'Sales' },
      { to: '/analytics/marketing', icon: 'i-hugeicons-megaphone-01', text: 'Marketing' },
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
      { to: '/management/permissions', icon: 'i-hugeicons-lock-key', text: 'Permissions' },
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
  {
    id: 1,
    name: 'Stacks.js',
    email: 'chris@stacksjs.org',
    type: 'Personal',
    logo: '/images/logos/logo.svg'
  },
  {
    id: 2,
    name: 'Jetbrains',
    email: 'support@jetbrains.com',
    type: 'Professional',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJMFMsdKNyFFDlff2bj1WT06bM8n-bFcnBLw&s'
  }
])

const currentTeam = ref<Team>(teams.value[0] ?? {
  id: 1,
  name: 'Stacks.js',
  email: 'chris@stacksjs.org',
  type: 'Personal',
  logo: '/images/logos/logo.svg'
})

const switchTeam = (team: Team) => {
  currentTeam.value = team
  showTeamSwitcher.value = false
  // Add your team switching logic here
}

// Add reference for the button
const teamSwitcherButton = ref<HTMLElement | null>(null)

// Compute position for the teleported dropdown
const teamSwitcherPosition = computed(() => {
  if (!teamSwitcherButton.value) return {}

  const rect = teamSwitcherButton.value.getBoundingClientRect()

  // Calculate the dropdown width
  const dropdownWidth = 256; // Width in pixels

  // Calculate the left position to center the dropdown under the button
  // We want to position it so it's not cut off on either side
  const buttonCenter = rect.left + (rect.width / 2);
  const leftPosition = Math.max(16, buttonCenter - (dropdownWidth / 2));

  return {
    top: `${rect.bottom + 8}px`,
    left: `${leftPosition}px`
  }
})

// Check if any child route is active for a parent item
const isChildRouteActive = (item: SidebarItem) => {
  if (!item.children) return false

  // Check if the current route exactly matches any child route
  return item.children.some(child =>
    route.path === child.to
  )
}

// Add transition functions for dropdown animation
const startTransition = (el: Element, done: () => void) => {
  const element = el as HTMLElement
  element.style.maxHeight = '0'
  element.style.width = '100%'
  element.style.overflow = 'hidden'
  // Force a reflow
  void element.offsetHeight
  // Set the max height to the scroll height to trigger the transition
  element.style.maxHeight = `${element.scrollHeight}px`
  // Call done when transition completes
  el.addEventListener('transitionend', () => {
    // Remove the max height constraint after animation completes
    element.style.maxHeight = 'none'
    done()
  }, { once: true })
}

const endTransition = (el: Element, done: () => void) => {
  const element = el as HTMLElement
  // First set the max height to the current height
  element.style.maxHeight = `${element.scrollHeight}px`
  element.style.overflow = 'hidden'
  // Force a reflow
  void element.offsetHeight
  // Then animate to 0
  element.style.maxHeight = '0'
  // Call done when transition completes
  el.addEventListener('transitionend', done, { once: true })
}

// Add transition functions for section transition
const startSectionTransition = (el: Element, done: () => void) => {
  const element = el as HTMLElement
  element.style.maxHeight = '0'
  element.style.width = '100%'
  element.style.overflow = 'hidden'
  // Force a reflow
  void element.offsetHeight
  // Set the max height to the scroll height to trigger the transition
  element.style.maxHeight = `${element.scrollHeight}px`
  // Call done when transition completes
  el.addEventListener('transitionend', () => {
    // Remove the max height constraint after animation completes
    element.style.maxHeight = 'none'
    done()
  }, { once: true })
}

const endSectionTransition = (el: Element, done: () => void) => {
  const element = el as HTMLElement
  // First set the max height to the current height
  element.style.maxHeight = `${element.scrollHeight}px`
  element.style.overflow = 'hidden'
  // Force a reflow
  void element.offsetHeight
  // Then animate to 0
  element.style.maxHeight = '0'
  // Call done when transition completes
  el.addEventListener('transitionend', done, { once: true })
}

// Add a ref to store dropdown positions
const dropdownPositions = ref<Record<string, number>>({})

// Function to calculate dropdown position
const calculateDropdownPosition = (event: MouseEvent, itemPath: string) => {
  const target = event.currentTarget as HTMLElement
  if (target) {
    const rect = target.getBoundingClientRect()
    // Center the dropdown vertically relative to the button
    dropdownPositions.value[itemPath] = rect.top - 5
  }
}

// Add refs for dropdown menus
const dropdownRefs = ref<Record<string, HTMLElement | null>>({})

// Function to close all dropdowns
const closeAllDropdowns = () => {
  Object.keys(expandedItems.value).forEach(key => {
    if (expandedItems.value[key]) {
      expandedItems.value[key] = false
    }
  })
}

// Add event listener to close dropdowns when clicking outside
onMounted(() => {
  document.addEventListener('click', (event) => {
    // Only process if we have open dropdowns and we're in collapsed mode
    if (isSidebarCollapsed.value && Object.values(expandedItems.value).some(v => v)) {
      const target = event.target as HTMLElement
      // Check if the click is outside any dropdown
      if (!target.closest('.sidebar-dropdown-menu') && !target.closest('.sidebar-dropdown-trigger')) {
        closeAllDropdowns()
      }
    }
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeAllDropdowns)
})

// Add transition functions for accordion animation in collapsed mode
const startAccordionTransition = (el: Element, done: () => void) => {
  const element = el as HTMLElement
  // Start with height 0
  element.style.height = '0'
  // Force a reflow
  void element.offsetHeight
  // Set the height to the scroll height to trigger the transition
  element.style.height = `${element.scrollHeight}px`
  // Call done when transition completes
  el.addEventListener('transitionend', () => {
    // Remove the height constraint after animation completes
    element.style.height = 'auto'
    done()
  }, { once: true })
}

const endAccordionTransition = (el: Element, done: () => void) => {
  const element = el as HTMLElement
  // First set the height to the current height
  element.style.height = `${element.scrollHeight}px`
  // Force a reflow
  void element.offsetHeight
  // Then animate to 0
  element.style.height = '0'
  // Call done when transition completes
  el.addEventListener('transitionend', done, { once: true })
}

// Add color mapping for section icons
const sectionColors: Record<string, string> = {
  library: 'text-blue-600 dark:text-blue-400',
  content: 'text-blue-600 dark:text-blue-400',
  app: 'text-blue-600 dark:text-blue-400',
  data: 'text-blue-600 dark:text-blue-400',
  commerce: 'text-cyan-600 dark:text-cyan-400',
  marketing: 'text-purple-600 dark:text-purple-400',
  analytics: 'text-emerald-600 dark:text-emerald-400',
  management: 'text-blue-600 dark:text-blue-400'
}

// Function to get icon color based on section
const getIconColor = (sectionKey: string, isActive: boolean = false) => {
  if (isActive) return 'text-blue-600 dark:text-blue-400'
  return sectionColors[sectionKey] || 'text-gray-400 dark:text-gray-200'
}
</script>

<template>
  <div>
    <!-- Static sidebar for desktop -->
    <div
      class="hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ease-in-out"
      :class="isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'"
    >
      <div
        class="flex grow flex-col gap-y-3 overflow-y-auto border-r border-gray-200 bg-white dark:border-gray-600 dark:bg-blue-gray-900 transition-all duration-300"
        :class="{
          'items-center px-2 pb-4': isSidebarCollapsed,
          'px-6 pb-4': !isSidebarCollapsed
        }"
      >
        <div class="pt-4 h-10 flex shrink-0 items-center justify-between rounded-lg">
          <RouterLink to="/" :class="isSidebarCollapsed ? 'hidden' : ''">
            <img class="h-10 w-auto rounded-lg cursor-pointer" :src="currentTeam.logo" :alt="`${currentTeam.name} Logo`">
          </RouterLink>

          <div class="flex items-center space-x-2">
            <!-- Sidebar Toggle Button -->
            <Tooltip text="Toggle sidebar" position="right" :dark="isDark" :usePortal="true">
              <button
                type="button"
                class="p-1.5 text-gray-400 hover:text-gray-500 focus:outline-none rounded-md hover:bg-gray-50 dark:hover:bg-blue-gray-800 flex items-center justify-center"
                @click="toggleSidebar"
              >
                <div
                  class="i-hugeicons-layout-01 h-5 w-5 cursor-pointer text-gray-400 transition-all duration-300 ease-in-out hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100"
                  :class="{ 'transform rotate-180': isSidebarCollapsed }"
                />
              </button>
            </Tooltip>

            <!-- Team Switcher -->
            <div class="relative" ref="teamSwitcherRef" :class="isSidebarCollapsed ? 'hidden' : ''">
              <button
                type="button"
                class="block p-2 text-gray-400 hover:text-gray-500 focus:outline-none"
                @click="showTeamSwitcher = !showTeamSwitcher"
                ref="teamSwitcherButton"
              >
                <div class="i-hugeicons-more-horizontal-circle-01 h-6 w-6 cursor-pointer text-gray-400 transition duration-150 ease-in-out hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100" />
              </button>

              <!-- Team Switcher Dropdown using Teleport -->
              <Teleport to="body">
                <div
                  v-if="showTeamSwitcher"
                  class="fixed z-50 rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none dark:bg-blue-gray-800 dark:ring-gray-700"
                  style="width: 256px;"
                  role="menu"
                  aria-orientation="vertical"
                  tabindex="-1"
                  :style="teamSwitcherPosition"
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
                              :src="team.logo"
                              :alt="`${team.name} logo`"
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
              </Teleport>
            </div>
          </div>
        </div>

        <nav class="flex flex-1 flex-col w-full">
          <ul role="list" class="flex flex-1 flex-col gap-y-4">
            <!-- Dashboard section -->
            <li>
              <ul role="list" class="mt-1 -mx-2 space-y-1" :class="{ 'mx-0 flex flex-col items-center': isSidebarCollapsed }">
                <li>
                  <template v-if="isSidebarCollapsed">
                    <Tooltip text="Home" position="right" :dark="isDark" :usePortal="true">
                      <RouterLink to="/" class="group sidebar-links justify-center" :class="{ 'home-link': route.path === '/' }">
                        <div class="i-hugeicons-home-05 h-5 w-5 text-gray-400 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700 mt-0.5" />
                      </RouterLink>
                    </Tooltip>
                  </template>
                  <RouterLink v-else to="/" class="group sidebar-links" :class="{ 'home-link': route.path === '/' }">
                    <div class="i-hugeicons-home-05 h-5 w-5 text-gray-400 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700 mt-0.5" />
                    <span>Home</span>
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
                  'cursor-grab': !isDragging,
                  'w-full': true
                }"
                @dragstart="handleDragStart(sectionKey, $event)"
                @dragover="handleDragOver(sectionKey, $event)"
                @dragend="handleDragEnd"
              >
                <!-- Section header -->
                <div
                  class="flex items-center justify-between cursor-pointer py-1.5 mb-1"
                  @click="toggleSection(sectionKey)"
                  :class="{ 'justify-center': isSidebarCollapsed }"
                >
                  <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider" :class="{ 'hidden': isSidebarCollapsed }">
                    {{ sectionKey }}
                  </h2>
                  <div class="flex items-center justify-center" :class="{ 'w-full': isSidebarCollapsed }">
                    <button
                      type="button"
                      class="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                      @click.stop="toggleSection(sectionKey)"
                    >
                      <div
                        class="i-hugeicons-arrow-right-01 h-5 w-5 transition-transform duration-200 mt-0.5"
                        :class="[
                          { 'transform rotate-90': sections[sectionKey] },
                          isSidebarCollapsed ? 'mx-auto' : ''
                        ]"
                      />
                    </button>
                  </div>
                </div>

                <!-- Section items with transition -->
                <transition
                  name="section-transition"
                  @enter="startSectionTransition"
                  @leave="endSectionTransition"
                >
                  <div
                    v-if="sections[sectionKey] && !isSidebarCollapsed"
                    class="section-content mt-1 -mx-2 space-y-0.5 w-full"
                    :style="{ maxHeight: 'none' }"
                  >
                    <template v-for="item in sectionContent[sectionKey]?.items" :key="item.to">
                      <!-- Regular item -->
                      <li v-if="!item.children" class="w-full">
                        <Tooltip v-if="isSidebarCollapsed" :text="item.text" position="right" :dark="isDark" :usePortal="true">
                          <RouterLink :to="item.to" class="group sidebar-links justify-center">
                            <div v-if="item.icon" :class="[item.icon, 'h-5 w-5 transition duration-150 ease-in-out group-hover:text-gray-700', getIconColor(sectionKey, route.path === item.to)]" />
                            <div v-else-if="item.letter" class="flex h-5 w-5 items-center justify-center rounded-md border border-blue-600 bg-white text-[10px] font-medium text-blue-600 dark:border-blue-500 dark:bg-blue-gray-800 dark:text-blue-400">
                              {{ item.letter }}
                            </div>
                          </RouterLink>
                        </Tooltip>
                        <RouterLink v-else :to="item.to" class="group sidebar-links w-full">
                          <div v-if="item.icon" :class="[item.icon, 'h-5 w-5 transition duration-150 ease-in-out group-hover:text-gray-700', getIconColor(sectionKey, route.path === item.to)]" />
                          <div v-else-if="item.letter" class="flex h-5 w-5 items-center justify-center rounded-md border border-blue-600 bg-white text-[10px] font-medium text-blue-600 dark:border-blue-500 dark:bg-blue-gray-800 dark:text-blue-400">
                            {{ item.letter }}
                          </div>
                          <span class="flex-1">{{ item.text }}</span>
                        </RouterLink>
                      </li>

                      <!-- Dropdown item in expanded mode -->
                      <li v-else class="w-full">
                        <button
                          @click="(event) => {
                            event.stopPropagation();
                            toggleItem(item.to);
                          }"
                          class="group sidebar-links w-full text-left sidebar-dropdown-trigger"
                          :class="{ 'parent-active': isChildRouteActive(item) }"
                        >
                          <div v-if="item.icon" :class="[item.icon, 'h-5 w-5 transition duration-150 ease-in-out group-hover:text-gray-700', getIconColor(sectionKey, isChildRouteActive(item))]" />
                          <div v-else-if="item.letter" class="flex h-5 w-5 items-center justify-center rounded-md border border-blue-600 bg-white text-[10px] font-medium text-blue-600 dark:border-blue-500 dark:bg-blue-gray-800 dark:text-blue-400">
                            {{ item.letter }}
                          </div>
                          <span class="flex-1">{{ item.text }}</span>
                          <div
                            class="i-hugeicons-arrow-right-01 ml-auto h-4 w-4 text-gray-400 transition-transform duration-200"
                            :class="{ 'transform rotate-90': expandedItems[item.to] }"
                          />
                        </button>

                        <!-- Dropdown content with transition -->
                        <transition
                          name="dropdown"
                          @enter="startTransition"
                          @leave="endTransition"
                        >
                          <div
                            v-if="expandedItems[item.to]"
                            class="dropdown-list mt-0.5 space-y-0.5 pl-6 ml-0 w-full"
                            :data-dropdown-id="item.to"
                            :style="{ maxHeight: 'none' }"
                          >
                            <div
                              v-for="child in item.children"
                              :key="child.to"
                              class="dropdown-item w-full"
                            >
                              <RouterLink
                                :to="child.to"
                                class="sidebar-child-link w-full"
                              >
                                <div v-if="child.icon" :class="[child.icon, 'h-4 w-4 mr-2', getIconColor(sectionKey, route.path === child.to)]" />
                                <span class="flex-1">{{ child.text }}</span>
                              </RouterLink>
                            </div>
                          </div>
                        </transition>
                      </li>
                    </template>
                  </div>
                </transition>

                <!-- Special case for collapsed sidebar -->
                <div
                  v-if="isSidebarCollapsed"
                  class="mx-0 flex flex-col items-center"
                >
                  <!-- Section header is always visible -->

                  <!-- Accordion-style transition for section content -->
                  <transition
                    name="accordion"
                    @enter="startAccordionTransition"
                    @leave="endAccordionTransition"
                  >
                    <div
                      v-if="sections[sectionKey]"
                      class="w-full flex flex-col items-center space-y-0.5 accordion-content overflow-hidden"
                    >
                      <template v-for="item in sectionContent[sectionKey]?.items" :key="item.to">
                        <!-- Regular item -->
                        <li v-if="!item.children" class="flex justify-center w-full">
                          <Tooltip v-if="isSidebarCollapsed" :text="item.text" position="right" :dark="isDark" :usePortal="true">
                            <RouterLink :to="item.to" class="group sidebar-links justify-center">
                              <div v-if="item.icon" :class="[item.icon, 'h-5 w-5 transition duration-150 ease-in-out group-hover:text-gray-700', getIconColor(sectionKey, route.path === item.to)]" />
                              <div v-else-if="item.letter" class="flex h-5 w-5 items-center justify-center rounded-md border border-blue-600 bg-white text-[10px] font-medium text-blue-600 dark:border-blue-500 dark:bg-blue-gray-800 dark:text-blue-400">
                                {{ item.letter }}
                              </div>
                            </RouterLink>
                          </Tooltip>
                        </li>

                        <!-- Dropdown item in collapsed mode -->
                        <li v-else class="flex justify-center w-full">
                          <div class="relative flex justify-center">
                            <Tooltip v-if="isSidebarCollapsed" :text="item.text" position="right" :dark="isDark" :usePortal="true">
                              <button
                                @click="(event) => {
                                  event.stopPropagation();
                                  toggleItem(item.to);
                                  calculateDropdownPosition(event as MouseEvent, item.to);
                                }"
                                class="group sidebar-links justify-center sidebar-dropdown-trigger"
                                :class="{ 'parent-active': isChildRouteActive(item) }"
                              >
                                <div v-if="item.icon" :class="[item.icon, 'h-5 w-5 transition duration-150 ease-in-out group-hover:text-gray-700', getIconColor(sectionKey, isChildRouteActive(item))]" />
                                <div v-else-if="item.letter" class="flex h-5 w-5 items-center justify-center rounded-md border border-blue-600 bg-white text-[10px] font-medium text-blue-600 dark:border-blue-500 dark:bg-blue-gray-800 dark:text-blue-400">
                                  {{ item.letter }}
                                </div>
                              </button>
                            </Tooltip>
                          </div>

                          <!-- Teleport dropdown for collapsed mode -->
                          <Teleport to="body" v-if="expandedItems[item.to]">
                            <div
                              class="fixed z-50 rounded-lg bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none dark:bg-blue-gray-800 dark:ring-gray-700 sidebar-dropdown-menu"
                              style="width: 200px;"
                              :style="{
                                top: `${dropdownPositions[item.to] || 100}px`,
                                left: '64px',
                                transform: 'translateX(0)'
                              }"
                            >
                              <div class="px-2 py-1">
                                <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.text }}</h3>
                              </div>
                              <div class="border-t border-gray-100 dark:border-gray-700">
                                <div class="max-h-96 overflow-y-auto py-1">
                                  <RouterLink
                                    v-for="child in item.children"
                                    :key="child.to"
                                    :to="child.to"
                                    class="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-blue-gray-700"
                                    :class="{ 'bg-gray-50 text-blue-600 dark:bg-blue-gray-700 dark:text-blue-400': route.path === child.to }"
                                    @click="expandedItems[item.to] = false"
                                  >
                                    <div class="flex items-center">
                                      <div v-if="child.icon" :class="[child.icon, 'h-4 w-4 mr-2', getIconColor(sectionKey, route.path === child.to)]" />
                                      <span>{{ child.text }}</span>
                                    </div>
                                  </RouterLink>
                                </div>
                              </div>
                            </div>
                          </Teleport>
                        </li>
                      </template>
                    </div>
                  </transition>
                </div>
              </li>
            </template>

            <!-- Bottom section -->
            <li class="mt-auto pb-4">
              <div :class="isSidebarCollapsed ? 'flex flex-col items-center justify-center space-y-6' : 'flex items-center space-x-4'">
                <Tooltip text="AI Buddy" position="top" :dark="isDark" :usePortal="true">
                  <RouterLink
                    to="/buddy"
                    class="sidebar-bottom-link"
                    :class="{ 'active-bottom-link': route.path === '/buddy' }"
                  >
                    <div class="i-hugeicons-ai-chat-02 h-5 w-5 text-gray-400 transition-all duration-150 ease-in-out dark:text-gray-200 group-hover:text-blue-600" />
                  </RouterLink>
                </Tooltip>

                <Tooltip text="Environment" position="top" :dark="isDark" :usePortal="true">
                  <RouterLink
                    to="/environment"
                    class="sidebar-bottom-link"
                    :class="{ 'active-bottom-link': route.path === '/environment' }"
                  >
                    <div class="i-hugeicons-key-01 h-5 w-5 text-gray-400 transition-all duration-150 ease-in-out dark:text-gray-200 group-hover:text-blue-600" />
                  </RouterLink>
                </Tooltip>

                <Tooltip text="Access Tokens" position="top" :dark="isDark" :usePortal="true">
                  <RouterLink
                    to="/access-tokens"
                    class="sidebar-bottom-link"
                    :class="{ 'active-bottom-link': route.path === '/access-tokens' }"
                  >
                    <div class="i-hugeicons-shield-key h-5 w-5 text-gray-400 transition-all duration-150 ease-in-out dark:text-gray-200 group-hover:text-blue-600" />
                  </RouterLink>
                </Tooltip>

                <Tooltip text="Settings" position="top" :dark="isDark" :usePortal="true">
                  <RouterLink
                    to="/settings/ai"
                    class="sidebar-bottom-link"
                    :class="{ 'active-bottom-link': route.path.startsWith('/settings/ai') }"
                  >
                    <div class="i-hugeicons-settings-02 h-5 w-5 text-gray-400 transition-all duration-150 ease-in-out dark:text-gray-200 group-hover:text-blue-600" />
                  </RouterLink>
                </Tooltip>
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <!-- Add class to body when sidebar is collapsed -->
    <Teleport to="body" v-if="isSidebarCollapsed">
      <div class="sidebar-collapsed hidden"></div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Add transition for sidebar collapse */
.sidebar-links {
  @apply flex items-center gap-x-2 p-1 text-sm leading-6 text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-blue-gray-800 rounded-md;
  transition: all 0.3s ease;
}

/* When sidebar is collapsed, adjust links */
:deep(.lg\:w-20) .sidebar-links {
  @apply justify-center px-0 rounded-md;
  width: 32px;
  height: 32px;
  margin: 0 auto;
  padding: 0.375rem; /* 6px */
}

/* Active state styling */
.router-link-active {
  @apply bg-gray-100 text-blue-600 dark:bg-blue-gray-800 dark:text-blue-400 rounded-md;
}

.router-link-exact-active {
  @apply bg-gray-100 text-blue-600 dark:bg-blue-gray-800 dark:text-blue-400 font-medium rounded-md;
}

.router-link-active div[class^="i-hugeicons"],
.router-link-exact-active div[class^="i-hugeicons"] {
  @apply text-blue-600 dark:text-blue-400;
}

/* Parent active state when child is active */
.parent-active {
  @apply text-blue-600 dark:text-blue-400;
}

.parent-active div[class^="i-hugeicons"] {
  @apply text-blue-600 dark:text-blue-400;
}

/* Nested items styling */
.dropdown-list {
  overflow: visible;
  transition: max-height 0.3s ease;
  @apply border-l border-gray-200 dark:border-blue-gray-700;
  width: 100%;
  position: relative;
  padding-left: 0.75rem;
}

.dropdown-item {
  position: relative;
  width: 100%;
}

.sidebar-child-link {
  @apply flex items-center rounded-md py-0.5 px-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-blue-gray-800;
  transition: all 0.2s ease;
  width: calc(100% - 16px);
  margin-left: 0;
  margin-right: auto;
}

.sidebar-child-link.router-link-active {
  @apply text-blue-600 dark:text-blue-400 font-medium bg-gray-100 dark:bg-blue-gray-800;
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: max-height 0.3s ease;
  width: 100%;
}

.dropdown-enter-from,
.dropdown-leave-to {
  max-height: 0;
}

/* Section transition */
.section-transition-enter-active,
.section-transition-leave-active {
  transition: max-height 0.3s ease;
  width: 100%;
  position: relative;
}

.section-transition-enter-from,
.section-transition-leave-to {
  max-height: 0;
}

.section-content {
  overflow: visible;
  width: 100%;
  position: relative;
}

/* Bottom links styling */
.sidebar-bottom-link {
  @apply flex items-center p-1.5 text-gray-400 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 rounded-md;
  transition: all 0.2s ease;
}

:deep(.lg\:w-20) .sidebar-bottom-link {
  @apply justify-center;
  width: 32px;
  height: 32px;
  padding: 0.375rem; /* 6px */
}

.active-bottom-link div {
  @apply text-blue-600 dark:text-blue-400;
}

/* Adjust main content when sidebar is collapsed */
:deep(.lg\:pl-64) {
  transition: padding-left 0.3s ease;
}

:deep(.sidebar-collapsed .lg\:pl-64) {
  padding-left: 5rem !important; /* 5rem = 80px (w-20) */
}

/* Ensure logo is properly rounded */
img.rounded-lg {
  overflow: hidden;
}

/* Special styling for home link */
.home-link {
  @apply rounded-md bg-gray-100;
}

.dark .home-link {
  background-color: rgba(30, 41, 59, 0.5);
}

.dark .home-link.router-link-active {
  background-color: rgba(30, 41, 59, 0.8);
}

/* Accordion transition for collapsed sidebar sections */
.accordion-enter-active,
.accordion-leave-active {
  transition: height 0.3s ease;
  overflow: hidden;
}

.accordion-enter-from,
.accordion-leave-to {
  height: 0;
}

.accordion-content {
  margin-top: 0.5rem;
}

/* Remove the fade transition since we're using accordion now */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Dropdown menu styling */
.sidebar-dropdown-menu {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* Ensure all items in collapsed sidebar are properly centered */
:deep(.lg\:w-20) .flex.flex-col.items-center button,
:deep(.lg\:w-20) .flex.flex-col.items-center a {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 32px;
  padding: 0.375rem;
  margin: 0 auto;
}
</style>
