<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref } from 'vue'
import { useHead } from '@vueuse/head'
import DashboardLayout from '../../components/Dashboard/DashboardLayout.vue'
import { StatsCard, Card, Badge, Button, Select } from '../../components/Dashboard/UI'

useHead({
  title: 'Dashboard - Overview',
})

// Time range filter
const timeRange = ref('7d')
const timeRangeOptions = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
]

// Sample data for the dashboard
const stats = [
  { title: 'Total Users', value: '8,294', trend: 12.5, trendLabel: 'vs last period', icon: 'i-hugeicons-user-group', iconBg: 'primary' as const },
  { title: 'Active Projects', value: '124', trend: 8.2, trendLabel: 'vs last period', icon: 'i-hugeicons-folder-02', iconBg: 'success' as const },
  { title: 'Cloud Uptime', value: '99.98%', trend: 0.1, trendLabel: 'vs last period', icon: 'i-hugeicons-cloud', iconBg: 'info' as const },
  { title: 'Response Time', value: '42ms', trend: -3.7, trendLabel: 'faster than before', icon: 'i-hugeicons-time-02', iconBg: 'warning' as const },
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
  { name: 'Commerce', description: 'View orders and manage products', icon: 'i-hugeicons-shopping-cart-02', href: '/commerce/dashboard', color: 'bg-green-500' },
  { name: 'Cloud', description: 'Monitor cloud performance and status', icon: 'i-hugeicons-cloud', href: '/cloud', color: 'bg-purple-500' },
  { name: 'Settings', description: 'Configure your application settings', icon: 'i-hugeicons-settings-01', href: '/settings', color: 'bg-neutral-500' },
]

// Sample data for system health
const systemHealth = [
  { name: 'API', status: 'healthy', latency: '38ms', uptime: '99.99%' },
  { name: 'Database', status: 'healthy', latency: '45ms', uptime: '99.98%' },
  { name: 'Storage', status: 'healthy', latency: '22ms', uptime: '100%' },
  { name: 'Cache', status: 'healthy', latency: '12ms', uptime: '99.95%' },
  { name: 'Queue', status: 'degraded', latency: '120ms', uptime: '99.90%' },
  { name: 'Notifications', status: 'healthy', latency: '12ms', uptime: '99.95%' },
]

// Get icon based on activity type
function getActivityIcon(type: string): string {
  const icons: Record<string, string> = {
    deployment: 'i-hugeicons-rocket-02',
    blog: 'i-hugeicons-document-validation',
    cloud: 'i-hugeicons-cloud',
    error: 'i-hugeicons-alert-02',
    commerce: 'i-hugeicons-shopping-cart-02',
    server: 'i-hugeicons-server-01',
  }
  return icons[type] || 'i-hugeicons-information-circle'
}

// Get color based on activity status
function getActivityStyles(status: string): string {
  const styles: Record<string, string> = {
    success: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
    error: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
    warning: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
  }
  return styles[status] || 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30'
}

// Get status badge variant
function getStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  const variants: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
    healthy: 'success',
    degraded: 'warning',
    critical: 'danger',
  }
  return variants[status] || 'default'
}
</script>

<template>
  <DashboardLayout>
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">Dashboard</h1>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Welcome back! Here's an overview of your system.
        </p>
      </div>
      <div class="w-44">
        <Select
          v-model="timeRange"
          :options="timeRangeOptions"
          size="sm"
        />
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <StatsCard
        v-for="stat in stats"
        :key="stat.title"
        :title="stat.title"
        :value="stat.value"
        :trend="stat.trend"
        :trend-label="stat.trendLabel"
        :icon="stat.icon"
        :icon-bg="stat.iconBg"
      />
    </div>

    <!-- Quick Links -->
    <div class="mb-8">
      <h2 class="text-base font-semibold text-neutral-900 dark:text-white mb-4">Quick Links</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RouterLink
          v-for="link in quickLinks"
          :key="link.name"
          :to="link.href"
        >
          <Card hoverable class="h-full">
            <div class="flex items-center gap-4">
              <div :class="[link.color, 'flex-shrink-0 rounded-xl p-3']">
                <div :class="[link.icon, 'h-6 w-6 text-white']" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-neutral-900 dark:text-white">{{ link.name }}</p>
                <p class="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400 truncate">
                  {{ link.description }}
                </p>
              </div>
              <div class="i-hugeicons-arrow-right-01 h-5 w-5 text-neutral-400 flex-shrink-0" />
            </div>
          </Card>
        </RouterLink>
      </div>
    </div>

    <!-- System Health and Recent Activity -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- System Health -->
      <Card>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold text-neutral-900 dark:text-white">System Health</h3>
            <RouterLink to="/health">
              <Button variant="ghost" size="sm">
                View all
                <template #iconRight>
                  <div class="i-hugeicons-arrow-right-01 w-4 h-4" />
                </template>
              </Button>
            </RouterLink>
          </div>
        </template>

        <div class="divide-y divide-neutral-200 dark:divide-neutral-700 -mx-6 -mb-6">
          <div
            v-for="service in systemHealth"
            :key="service.name"
            class="flex items-center justify-between px-6 py-3.5"
          >
            <div class="flex items-center gap-3">
              <span
                :class="[
                  'h-2.5 w-2.5 rounded-full',
                  service.status === 'healthy' ? 'bg-green-500' : '',
                  service.status === 'degraded' ? 'bg-amber-500' : '',
                  service.status === 'critical' ? 'bg-red-500' : '',
                ]"
              />
              <span class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {{ service.name }}
              </span>
            </div>
            <div class="flex items-center gap-4">
              <span class="text-sm text-neutral-500 dark:text-neutral-400">
                {{ service.latency }}
              </span>
              <span class="text-sm text-neutral-500 dark:text-neutral-400 hidden sm:block">
                {{ service.uptime }}
              </span>
              <Badge :variant="getStatusVariant(service.status)" size="sm">
                {{ service.status }}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <!-- Recent Activity -->
      <Card>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold text-neutral-900 dark:text-white">Recent Activity</h3>
            <RouterLink to="/data/activity">
              <Button variant="ghost" size="sm">
                View all
                <template #iconRight>
                  <div class="i-hugeicons-arrow-right-01 w-4 h-4" />
                </template>
              </Button>
            </RouterLink>
          </div>
        </template>

        <div class="divide-y divide-neutral-200 dark:divide-neutral-700 -mx-6 -mb-6">
          <div
            v-for="activity in recentActivity"
            :key="activity.id"
            class="flex items-center gap-4 px-6 py-3.5"
          >
            <div :class="[getActivityStyles(activity.status), 'flex-shrink-0 rounded-lg p-2']">
              <div :class="[getActivityIcon(activity.type), 'h-5 w-5']" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-neutral-900 dark:text-white truncate">
                {{ activity.title }}
              </p>
              <p class="text-sm text-neutral-500 dark:text-neutral-400">
                {{ activity.time }}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Resources and Documentation -->
    <div class="mt-8">
      <Card>
        <template #header>
          <h3 class="text-base font-semibold text-neutral-900 dark:text-white">Resources & Documentation</h3>
        </template>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div class="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-5">
            <div class="flex gap-4">
              <div class="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                <div class="i-hugeicons-book-open-02 h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 class="text-sm font-semibold text-blue-900 dark:text-blue-200">Documentation</h4>
                <p class="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  Comprehensive guides and API references for developers.
                </p>
                <a
                  href="https://docs.stacksjs.org"
                  target="_blank"
                  class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  View documentation
                  <div class="i-hugeicons-arrow-right-01 w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          <div class="rounded-xl bg-green-50 dark:bg-green-900/20 p-5">
            <div class="flex gap-4">
              <div class="flex-shrink-0 p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                <div class="i-hugeicons-video-01 h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 class="text-sm font-semibold text-green-900 dark:text-green-200">Video Tutorials</h4>
                <p class="mt-1 text-sm text-green-700 dark:text-green-300">
                  Step-by-step video guides for common tasks and features.
                </p>
                <a
                  href="#"
                  class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-500 dark:text-green-400"
                >
                  Watch tutorials
                  <div class="i-hugeicons-arrow-right-01 w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          <div class="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-5">
            <div class="flex gap-4">
              <div class="flex-shrink-0 p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                <div class="i-hugeicons-user-group h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h4 class="text-sm font-semibold text-purple-900 dark:text-purple-200">Community</h4>
                <p class="mt-1 text-sm text-purple-700 dark:text-purple-300">
                  Join our community forums for support and discussions.
                </p>
                <a
                  href="https://discord.gg/stacksjs"
                  target="_blank"
                  class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-500 dark:text-purple-400"
                >
                  Join community
                  <div class="i-hugeicons-arrow-right-01 w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </DashboardLayout>
</template>
