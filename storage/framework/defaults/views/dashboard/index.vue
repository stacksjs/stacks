<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Overview',
})

// Sample data for the dashboard
const stats = [
  { name: 'Total Users', value: '8,294', change: '+12.5%', trend: 'up' },
  { name: 'Active Projects', value: '124', change: '+8.2%', trend: 'up' },
  { name: 'Cloud Uptime', value: '99.98%', change: '+0.1%', trend: 'up' },
  { name: 'Response Time', value: '42ms', change: '-3.7%', trend: 'down' },
]

const recentActivity = [
  { id: 1, type: 'deployment', title: 'Production deployment successful', time: '10 minutes ago', status: 'success' },
  { id: 2, type: 'blog', title: 'New blog post published', time: '1 hour ago', status: 'success' },
  { id: 3, type: 'server', title: 'Server maintenance completed', time: '3 hours ago', status: 'success' },
  { id: 4, type: 'error', title: 'API rate limit exceeded', time: '5 hours ago', status: 'error' },
  { id: 5, type: 'commerce', title: 'New order received', time: '12 hours ago', status: 'success' },
]

const quickLinks = [
  { name: 'Blog', description: 'Manage your blog posts and categories', icon: 'i-hugeicons-document-validation', href: '/content/dashboard', color: 'bg-blue-500' },
  { name: 'Commerce', description: 'View orders and manage products', icon: 'i-hugeicons-shopping-cart-02', href: '/commerce', color: 'bg-green-500' },
  { name: 'Cloud', description: 'Monitor cloud performance and status', icon: 'i-hugeicons-ai-cloud', href: '/cloud', color: 'bg-purple-500' },
  { name: 'Settings', description: 'Configure your application settings', icon: 'i-hugeicons-settings-01', href: '/settings', color: 'bg-gray-500' },
]

const timeRange = ref('Last 7 days')
const timeRanges = ['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Last year', 'All time']

// Sample data for system health
const systemHealth = [
  { name: 'API', status: 'healthy', latency: '38ms', uptime: '99.99%' },
  { name: 'Database', status: 'healthy', latency: '45ms', uptime: '99.98%' },
  { name: 'Storage', status: 'healthy', latency: '22ms', uptime: '100%' },
  { name: 'Cache', status: 'healthy', latency: '12ms', uptime: '99.95%' },
  { name: 'Queue', status: 'degraded', latency: '120ms', uptime: '99.90%' },
  { name: 'Notifications', status: 'healthy', latency: '12ms', uptime: '99.95%' },
  { name: 'Printers', status: 'healthy', latency: '12ms', uptime: '99.95%' },
  { name: 'Health', status: 'healthy', latency: '12ms', uptime: '99.95%' },
]

// Get status color based on health status
function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'bg-green-400 dark:bg-green-500'
    case 'degraded':
      return 'bg-yellow-400 dark:bg-yellow-500'
    case 'critical':
      return 'bg-red-400 dark:bg-red-500'
    default:
      return 'bg-gray-400 dark:bg-gray-500'
  }
}

// Get icon based on activity type
function getActivityIcon(type: string): string {
  switch (type) {
    case 'deployment':
      return 'i-hugeicons-rocket-02'
    case 'blog':
      return 'i-hugeicons-document-validation'
    case 'cloud':
      return 'i-hugeicons-ai-cloud'
    case 'error':
      return 'i-hugeicons-alert-02'
    case 'commerce':
      return 'i-hugeicons-shopping-cart-02'
    default:
      return 'i-hugeicons-information-circle'
  }
}

// Get color based on activity status
function getActivityColor(status: string): string {
  switch (status) {
    case 'success':
      return 'text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
    case 'error':
      return 'text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/20'
    case 'warning':
      return 'text-yellow-500 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20'
    default:
      return 'text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20'
  }
}
</script>

<template>
  <main>
    <div class="relative isolate overflow-hidden">
      <div class="px-6 py-6 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-7xl">
          <!-- Page Header -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Welcome back! Here's an overview of your system.
              </p>
            </div>
            <div class="relative">
              <select v-model="timeRange" class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700">
                <option v-for="range in timeRanges" :key="range" :value="range">{{ range }}</option>
              </select>
            </div>
          </div>

          <!-- Stats -->
          <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div v-for="(stat, index) in stats" :key="index" class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">{{ stat.name }}</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ stat.value }}</dd>
              <dd class="mt-2 flex items-center text-sm" :class="stat.trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                <div :class="stat.trend === 'up' ? 'i-hugeicons-analytics-up' : 'i-hugeicons-analytics-down'" class="h-4 w-4 mr-1"></div>
                <span>{{ stat.change }}</span>
              </dd>
            </div>
          </dl>

          <!-- Quick Links -->
          <div class="mt-8">
            <h2 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Quick Links</h2>
            <div class="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <a v-for="link in quickLinks"
                 :key="link.name"
                 :href="link.href"
                 class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800 hover:shadow-md transition-shadow duration-200">
                <div class="p-5">
                  <div class="flex items-center">
                    <div :class="[link.color, 'flex-shrink-0 rounded-md p-3']">
                      <div :class="[link.icon, 'h-6 w-6 text-white']"></div>
                    </div>
                    <div class="ml-5 w-0 flex-1">
                      <dl>
                        <dt class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ link.name }}</dt>
                        <dd class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {{ link.description }}
                        </dd>
                      </dl>
                    </div>
                    <div class="flex-shrink-0 self-center">
                      <div class="i-hugeicons-arrow-right-01 h-5 w-5 text-gray-400"></div>
                    </div>
                  </div>
                </div>
              </a>
            </div>
          </div>

          <!-- System Health and Recent Activity -->
          <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <!-- System Health -->
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:px-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">System Health</h3>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700">
                <ul role="list" class="divide-y divide-gray-200 dark:divide-gray-700">
                  <li v-for="service in systemHealth" :key="service.name" class="px-4 py-4 sm:px-6">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center">
                        <div class="flex h-3 w-3 items-center">
                          <span :class="[getStatusColor(service.status), 'h-2.5 w-2.5 rounded-full']" aria-hidden="true"></span>
                        </div>
                        <p class="ml-3 text-sm font-medium text-gray-900 dark:text-white">{{ service.name }}</p>
                      </div>
                      <div class="flex items-center gap-4">
                        <div class="text-sm text-gray-500 dark:text-gray-400">
                          <span class="font-medium">{{ service.latency }}</span>
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">
                          <span class="font-medium">{{ service.uptime }}</span>
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 capitalize">
                          <span :class="{
                            'text-green-600 dark:text-green-400': service.status === 'healthy',
                            'text-yellow-600 dark:text-yellow-400': service.status === 'degraded',
                            'text-red-600 dark:text-red-400': service.status === 'critical'
                          }">{{ service.status }}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Recent Activity -->
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:px-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Recent Activity</h3>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700">
                <ul role="list" class="divide-y divide-gray-200 dark:divide-gray-700">
                  <li v-for="activity in recentActivity" :key="activity.id" class="px-4 py-4 sm:px-6">
                    <div class="flex items-center space-x-4">
                      <div :class="[getActivityColor(activity.status), 'flex-shrink-0 rounded-md p-2']">
                        <div :class="[getActivityIcon(activity.type), 'h-5 w-5']"></div>
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ activity.title }}</p>
                        <p class="truncate text-sm text-gray-500 dark:text-gray-400">{{ activity.time }}</p>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700 px-4 py-4 sm:px-6">
                <a href="/activity" class="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                  View all activity
                  <span aria-hidden="true"> &rarr;</span>
                </a>
              </div>
            </div>
          </div>

          <!-- Resources and Documentation -->
          <div class="mt-8">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:p-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Resources & Documentation</h3>
                <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div class="rounded-md bg-blue-50 dark:bg-blue-900/20 p-4">
                    <div class="flex">
                      <div class="flex-shrink-0">
                        <div class="i-hugeicons-book-open-02 h-5 w-5 text-blue-600 dark:text-blue-400"></div>
                      </div>
                      <div class="ml-3">
                        <h3 class="text-sm font-medium text-blue-800 dark:text-blue-300">Documentation</h3>
                        <p class="mt-2 text-sm text-blue-700 dark:text-blue-200">
                          Comprehensive guides and API references for developers.
                        </p>
                        <p class="mt-3">
                          <a href="#" class="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                            View documentation
                            <span aria-hidden="true"> &rarr;</span>
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div class="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
                    <div class="flex">
                      <div class="flex-shrink-0">
                        <div class="i-hugeicons-video-01 h-5 w-5 text-green-600 dark:text-green-400"></div>
                      </div>
                      <div class="ml-3">
                        <h3 class="text-sm font-medium text-green-800 dark:text-green-300">Video Tutorials</h3>
                        <p class="mt-2 text-sm text-green-700 dark:text-green-200">
                          Step-by-step video guides for common tasks and features.
                        </p>
                        <p class="mt-3">
                          <a href="#" class="text-sm font-medium text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300">
                            Watch tutorials
                            <span aria-hidden="true"> &rarr;</span>
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div class="rounded-md bg-purple-50 dark:bg-purple-900/20 p-4">
                    <div class="flex">
                      <div class="flex-shrink-0">
                        <div class="i-hugeicons-user-group h-5 w-5 text-purple-600 dark:text-purple-400"></div>
                      </div>
                      <div class="ml-3">
                        <h3 class="text-sm font-medium text-purple-800 dark:text-purple-300">Community</h3>
                        <p class="mt-2 text-sm text-purple-700 dark:text-purple-200">
                          Join our community forums for support and discussions.
                        </p>
                        <p class="mt-3">
                          <a href="#" class="text-sm font-medium text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300">
                            Join community
                            <span aria-hidden="true"> &rarr;</span>
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
