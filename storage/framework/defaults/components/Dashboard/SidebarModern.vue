<script setup lang="ts">
/**
 * Modern Sidebar Component
 * A revamped sidebar with cleaner design, better animations, and improved UX.
 */
import { computed, ref, watch } from 'vue'
import { useDark, useLocalStorage } from '@vueuse/core'
import Avatar from './UI/Avatar.vue'

interface SidebarItem {
  to: string
  icon?: string
  letter?: string
  text: string
  badge?: string | number
  children?: SidebarItem[]
}

interface SectionContent {
  items: SidebarItem[]
  icon?: string
}

interface Team {
  id: number
  name: string
  email: string
  type: 'Personal' | 'Professional'
  logo?: string
}

const emit = defineEmits<{
  (e: 'close'): void
}>()

const route = useRoute()
const router = useRouter()
const isDark = useDark()

// Sidebar state
const isCollapsed = useLocalStorage('sidebar-collapsed-modern', false)
const isHovered = ref(false)
const searchQuery = ref('')

// Section expansion state
const expandedSections = useLocalStorage<Record<string, boolean>>('sidebar-sections-modern', {
  library: true,
  content: false,
  app: false,
  data: false,
  commerce: false,
  marketing: false,
  analytics: false,
  management: false,
})

// Nested item expansion
const expandedItems = useLocalStorage<Record<string, boolean>>('sidebar-items-modern', {})

// Current team
const currentTeam = ref<Team>({
  id: 1,
  name: 'Stacks',
  email: 'team@stacksjs.com',
  type: 'Professional',
})

// Show full sidebar when hovered while collapsed
const showExpanded = computed(() => !isCollapsed.value || isHovered.value)

// Navigation sections
const sections: Record<string, { label: string; icon: string; content: SectionContent }> = {
  library: {
    label: 'Library',
    icon: 'i-hugeicons-book-02',
    content: {
      items: [
        { to: '/components', icon: 'i-hugeicons-puzzle', text: 'Components' },
        { to: '/functions', icon: 'i-hugeicons-function-square', text: 'Functions' },
        { to: '/releases', icon: 'i-hugeicons-right-to-left-list-number', text: 'Releases' },
        { to: '/packages', icon: 'i-hugeicons-package', text: 'Packages' },
      ],
    },
  },
  content: {
    label: 'Content',
    icon: 'i-hugeicons-file-02',
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
        { to: '/content/seo', icon: 'i-hugeicons-seo', text: 'SEO' },
      ],
    },
  },
  app: {
    label: 'App',
    icon: 'i-hugeicons-code',
    content: {
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
            { to: '/jobs', icon: 'i-hugeicons-briefcase-01', text: 'Jobs' },
          ],
        },
        {
          to: '#queries',
          icon: 'i-hugeicons-search-area',
          text: 'Queries',
          children: [
            { to: '/queries', icon: 'i-hugeicons-dashboard-speed-01', text: 'Dashboard' },
            { to: '/queries/history', icon: 'i-hugeicons-search-list-01', text: 'History' },
            { to: '/queries/slow', icon: 'i-hugeicons-snail', text: 'Slow Queries' },
          ],
        },
        { to: '/monitoring/errors', icon: 'i-hugeicons-bug-01', text: 'Errors' },
      ],
    },
  },
  commerce: {
    label: 'Commerce',
    icon: 'i-hugeicons-shopping-cart-02',
    content: {
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
          ],
        },
        { to: '/commerce/payments', icon: 'i-hugeicons-invoice-01', text: 'Payments' },
        { to: '/commerce/delivery', icon: 'i-hugeicons-shipping-truck-01', text: 'Delivery' },
      ],
    },
  },
  data: {
    label: 'Data',
    icon: 'i-hugeicons-database',
    content: {
      items: [
        { to: '/data/dashboard', icon: 'i-hugeicons-dashboard-speed-01', text: 'Dashboard' },
        { to: '/data/activity', icon: 'i-hugeicons-activity-01', text: 'Activity' },
        { to: '/data/users', icon: 'i-hugeicons-user-group', text: 'Users' },
        { to: '/data/teams', icon: 'i-hugeicons-user-multiple', text: 'Teams' },
        { to: '/data/subscribers', icon: 'i-hugeicons-mail-01', text: 'Subscribers' },
      ],
    },
  },
  marketing: {
    label: 'Marketing',
    icon: 'i-hugeicons-megaphone-01',
    content: {
      items: [
        { to: '/marketing/lists', icon: 'i-hugeicons-list-setting', text: 'Lists' },
        { to: '/marketing/social-posts', icon: 'i-hugeicons-time-schedule', text: 'Social Posts' },
        { to: '/marketing/campaigns', icon: 'i-hugeicons-rocket-01', text: 'Campaigns' },
        { to: '/marketing/reviews', icon: 'i-hugeicons-star', text: 'Reviews' },
      ],
    },
  },
  analytics: {
    label: 'Analytics',
    icon: 'i-hugeicons-chart-line-data-01',
    content: {
      items: [
        { to: '/analytics/web', icon: 'i-hugeicons-global', text: 'Web' },
        { to: '/analytics/blog', icon: 'i-hugeicons-edit-02', text: 'Blog' },
        { to: '/analytics/commerce', icon: 'i-hugeicons-shopping-bag-01', text: 'Commerce' },
        { to: '/analytics/events', icon: 'i-hugeicons-cursor-click-02', text: 'Events' },
      ],
    },
  },
  management: {
    label: 'Management',
    icon: 'i-hugeicons-settings-02',
    content: {
      items: [
        { to: '/cloud', icon: 'i-hugeicons-cloud', text: 'Cloud' },
        { to: '/dns', icon: 'i-hugeicons-internet', text: 'DNS' },
        { to: '/management/permissions', icon: 'i-hugeicons-shield-01', text: 'Permissions' },
        { to: '/mailboxes', icon: 'i-hugeicons-mailbox-01', text: 'Mailboxes' },
        { to: '/logs', icon: 'i-hugeicons-file-search', text: 'Logs' },
        { to: '/health', icon: 'i-hugeicons-pulse-02', text: 'Health' },
      ],
    },
  },
}

// Section order
const sectionOrder = useLocalStorage<string[]>('sidebar-order-modern', Object.keys(sections))

// Check if route is active
function isActiveRoute(path: string): boolean {
  if (path.startsWith('#')) return false
  return route.path === path || route.path.startsWith(path + '/')
}

// Check if section has active child
function sectionHasActiveChild(sectionKey: string): boolean {
  const section = sections[sectionKey]
  if (!section) return false

  return section.content.items.some((item) => {
    if (isActiveRoute(item.to)) return true
    if (item.children) {
      return item.children.some((child) => isActiveRoute(child.to))
    }
    return false
  })
}

// Toggle section
function toggleSection(key: string) {
  expandedSections.value[key] = !expandedSections.value[key]
}

// Toggle nested item
function toggleItem(path: string, event: Event) {
  event.preventDefault()
  event.stopPropagation()
  expandedItems.value[path] = !expandedItems.value[path]
}

// Navigate to route
function navigateTo(path: string, event?: Event) {
  if (path.startsWith('#')) {
    event?.preventDefault()
    return
  }
  router.push(path)
}

// Toggle dark mode
function toggleDark() {
  isDark.value = !isDark.value
}

// Toggle sidebar collapse
function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <aside
    :class="[
      'fixed inset-y-0 left-0 z-50',
      'flex flex-col',
      'bg-white dark:bg-neutral-900',
      'border-r border-neutral-200 dark:border-neutral-800',
      'transition-all duration-300 ease-out',
      isCollapsed && !isHovered ? 'w-16' : 'w-64',
    ]"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Header -->
    <div class="h-16 flex items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800">
      <!-- Logo & Team -->
      <div v-show="showExpanded" class="flex items-center gap-3 min-w-0">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
          S
        </div>
        <div class="min-w-0">
          <div class="text-sm font-semibold text-neutral-900 dark:text-white truncate">
            {{ currentTeam.name }}
          </div>
          <div class="text-xs text-neutral-500 dark:text-neutral-400 truncate">
            {{ currentTeam.type }}
          </div>
        </div>
      </div>

      <!-- Collapsed logo -->
      <div v-show="!showExpanded" class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm mx-auto">
        S
      </div>

      <!-- Collapse button -->
      <button
        v-show="showExpanded"
        type="button"
        class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
        @click="toggleCollapse"
      >
        <div :class="[isCollapsed ? 'i-hugeicons-sidebar-right' : 'i-hugeicons-sidebar-left', 'w-5 h-5']" />
      </button>
    </div>

    <!-- Search (only when expanded) -->
    <div v-show="showExpanded" class="px-3 py-3">
      <div class="relative">
        <div class="i-hugeicons-search-01 absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search..."
          class="w-full pl-9 pr-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border-0 rounded-lg text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-3 py-2 space-y-1">
      <template v-for="sectionKey in sectionOrder" :key="sectionKey">
        <div v-if="sections[sectionKey]" class="py-1">
          <!-- Section header -->
          <button
            type="button"
            :class="[
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left',
              'transition-colors duration-150',
              sectionHasActiveChild(sectionKey)
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-neutral-600 dark:text-neutral-400',
              'hover:bg-neutral-100 dark:hover:bg-neutral-800',
            ]"
            @click="toggleSection(sectionKey)"
          >
            <div :class="[sections[sectionKey].icon, 'w-5 h-5 flex-shrink-0']" />
            <span v-show="showExpanded" class="flex-1 text-sm font-medium">
              {{ sections[sectionKey].label }}
            </span>
            <div
              v-show="showExpanded"
              :class="[
                'i-hugeicons-arrow-down-01 w-4 h-4 transition-transform duration-200',
                expandedSections[sectionKey] ? 'rotate-180' : '',
              ]"
            />
          </button>

          <!-- Section items -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 max-h-0"
            enter-to-class="opacity-100 max-h-[1000px]"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 max-h-[1000px]"
            leave-to-class="opacity-0 max-h-0"
          >
            <div
              v-show="expandedSections[sectionKey] && showExpanded"
              class="mt-1 space-y-0.5 overflow-hidden"
            >
              <template v-for="item in sections[sectionKey].content.items" :key="item.to">
                <!-- Regular item -->
                <RouterLink
                  v-if="!item.children"
                  :to="item.to"
                  :class="[
                    'flex items-center gap-3 px-3 py-2 ml-2 rounded-lg text-sm',
                    'transition-colors duration-150',
                    isActiveRoute(item.to)
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                  ]"
                >
                  <div :class="[item.icon, 'w-4 h-4 flex-shrink-0']" />
                  <span class="truncate">{{ item.text }}</span>
                  <span
                    v-if="item.badge"
                    class="ml-auto text-xs bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded-full"
                  >
                    {{ item.badge }}
                  </span>
                </RouterLink>

                <!-- Item with children -->
                <div v-else>
                  <button
                    type="button"
                    :class="[
                      'w-full flex items-center gap-3 px-3 py-2 ml-2 rounded-lg text-sm text-left',
                      'transition-colors duration-150',
                      'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                    ]"
                    @click="toggleItem(item.to, $event)"
                  >
                    <div :class="[item.icon, 'w-4 h-4 flex-shrink-0']" />
                    <span class="flex-1 truncate">{{ item.text }}</span>
                    <div
                      :class="[
                        'i-hugeicons-arrow-down-01 w-3 h-3 transition-transform duration-200',
                        expandedItems[item.to] ? 'rotate-180' : '',
                      ]"
                    />
                  </button>

                  <!-- Nested children -->
                  <Transition
                    enter-active-class="transition-all duration-150 ease-out"
                    enter-from-class="opacity-0 max-h-0"
                    enter-to-class="opacity-100 max-h-[500px]"
                    leave-active-class="transition-all duration-100 ease-in"
                    leave-from-class="opacity-100 max-h-[500px]"
                    leave-to-class="opacity-0 max-h-0"
                  >
                    <div v-show="expandedItems[item.to]" class="mt-0.5 space-y-0.5 overflow-hidden">
                      <RouterLink
                        v-for="child in item.children"
                        :key="child.to"
                        :to="child.to"
                        :class="[
                          'flex items-center gap-3 px-3 py-1.5 ml-6 rounded-lg text-sm',
                          'transition-colors duration-150',
                          isActiveRoute(child.to)
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
                            : 'text-neutral-500 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-300',
                        ]"
                      >
                        <div :class="[child.icon, 'w-3.5 h-3.5 flex-shrink-0']" />
                        <span class="truncate">{{ child.text }}</span>
                      </RouterLink>
                    </div>
                  </Transition>
                </div>
              </template>
            </div>
          </Transition>
        </div>
      </template>
    </nav>

    <!-- Footer -->
    <div class="border-t border-neutral-200 dark:border-neutral-800 p-3 space-y-2">
      <!-- Quick actions -->
      <div v-show="showExpanded" class="flex items-center gap-2">
        <RouterLink
          to="/buddy"
          class="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <div class="i-hugeicons-ai-chat-02 w-4 h-4" />
          <span>AI Buddy</span>
        </RouterLink>
        <button
          type="button"
          class="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
          @click="toggleDark"
        >
          <div :class="[isDark ? 'i-hugeicons-sun-02' : 'i-hugeicons-moon-02', 'w-4 h-4']" />
        </button>
      </div>

      <!-- Settings link -->
      <RouterLink
        to="/settings"
        :class="[
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
          'transition-colors duration-150',
          isActiveRoute('/settings')
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
        ]"
      >
        <div class="i-hugeicons-settings-02 w-5 h-5" />
        <span v-show="showExpanded">Settings</span>
      </RouterLink>
    </div>
  </aside>
</template>
