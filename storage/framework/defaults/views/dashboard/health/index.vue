<script lang="ts" setup>
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

useHead({
  title: 'Dashboard - Health',
})

const healthMetrics = [
  {
    name: 'Uptime',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    status: 'success',
    description: 'Your site is up. We last checked less than a minute ago.',
    metrics: [
      { label: 'Past 7 Days', value: '100%' },
      { label: 'Past 14 Days', value: '100%' },
      { label: 'Past 30 Days', value: '100%' },
    ],
  },
  {
    name: 'Performance',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    status: 'success',
    description: "Your site is fast. Last checked 3 minutes ago.",
    metrics: [
      { label: 'Response Time', value: '235ms' },
      { label: 'Success Rate', value: '99.95%' },
    ],
  },
  {
    name: 'Certificate Health',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    status: 'success',
    description: 'Your certificate is healthy. We last checked 3 minutes ago.',
    metrics: [
      { label: 'Expires In', value: 'May 4, 2024 (14 days)' },
      { label: 'Last Renewal', value: 'Feb 4, 2024' }
    ],
  },
  {
    name: 'Broken Links',
    icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', // Link icon
    status: 'success',
    description: 'Your site has no broken links.',
    metrics: [
      { label: 'Broken Links', value: '0' },
      { label: 'URLs Crawled', value: '583' },
    ],
  },
  {
    name: 'Mixed Content',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', // Lock
    status: 'success',
    description: 'We did not find mixed content. We last checked an hour ago.',
    metrics: [
      { label: 'Pieces of Mixed Content', value: '0' },
      { label: 'URLs Crawled', value: '0' },
    ],
  },
  {
    name: 'Certificate Transparency',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    status: 'info',
    description: 'Your site is up. We last checked less than a minute ago.',
    metrics: [
      { label: 'Last Check', value: '< 1 min ago' },
      { label: 'Status', value: 'Verified' }
    ],
  },
  {
    name: 'Application Health',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', // Check circle
    status: 'success',
    description: 'Your application seems to be healthy. We last checked 10 minutes ago.',
    metrics: [
      { label: 'Total Health Checks', value: '2' },
      { label: 'Failed Health Checks', value: '0' },
      { label: 'Last Check', value: '10 min ago' },
    ],
  },
  {
    name: 'DNS',
    icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9', // Globe
    status: 'success',
    description: 'DNS records found. We last checked an hour ago.',
    metrics: [
      { label: 'DNS Records', value: '18' },
      { label: 'URLs Crawled', value: '20' },
    ],
  },
]

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      max: 100
    }
  }
}
</script>

<template>
  <div class="px-4 py-8 lg:px-8 sm:px-6">
    <!-- Overview Stats -->
    <div class="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="(stat, index) in [
        {
          name: 'Uptime',
          value: '100%',
          trend: 'up',
          icon: 'M13 10V3L4 14h7v7l9-11h-7z',
          bgColor: 'bg-blue-500',
          iconColor: 'text-white'
        },
        {
          name: 'Health Checks',
          value: '2/2',
          subValue: '100%',
          icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
          bgColor: 'bg-green-500',
          iconColor: 'text-white'
        },
        {
          name: 'URLs Monitored',
          value: '583',
          icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
          bgColor: 'bg-blue-500',
          iconColor: 'text-white'
        },
        {
          name: 'DNS Records',
          value: '18',
          icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
          bgColor: 'bg-blue-500',
          iconColor: 'text-white'
        }
      ]" :key="index"
        class="relative overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
        <div class="p-4">
          <div class="flex items-center">
            <div :class="['rounded-md p-2.5', stat.bgColor]">
              <svg :class="['h-5 w-5', stat.iconColor]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="stat.icon" />
              </svg>
            </div>
            <div class="ml-3 w-full">
              <p class="text-sm font-medium text-gray-500 dark:text-gray-300">{{ stat.name }}</p>
              <div class="flex items-baseline space-x-2">
                <p class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ stat.value }}</p>
                <span v-if="stat.subValue" class="text-sm font-medium text-green-600 dark:text-green-400">{{ stat.subValue }}</span>
                <svg v-if="stat.trend === 'up'" class="h-4 w-4 flex-shrink-0 self-center text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detailed Health Cards -->
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div
        v-for="metric in healthMetrics"
        :key="metric.name"
        class="relative overflow-hidden rounded-lg bg-white shadow transition-all duration-200 dark:bg-blue-gray-800"
      >
        <div class="p-6">
          <div class="flex items-center">
            <div :class="{
              'flex h-10 w-10 items-center justify-center rounded-lg': true,
              'bg-green-100 dark:bg-green-900': metric.status === 'success',
              'bg-blue-100 dark:bg-blue-900': metric.status === 'info',
              'bg-yellow-100 dark:bg-yellow-900': metric.status === 'warning',
              'bg-red-100 dark:bg-red-900': metric.status === 'error'
            }">
              <svg class="h-5 w-5" :class="{
                'text-green-600 dark:text-green-300': metric.status === 'success',
                'text-blue-600 dark:text-blue-300': metric.status === 'info',
                'text-yellow-600 dark:text-yellow-300': metric.status === 'warning',
                'text-red-600 dark:text-red-300': metric.status === 'error'
              }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="metric.icon" />
              </svg>
            </div>
            <div class="ml-4 flex-1">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {{ metric.name }}
                </h3>
                <span :class="{
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium': true,
                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200': metric.status === 'success',
                  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200': metric.status === 'info',
                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200': metric.status === 'warning',
                  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200': metric.status === 'error'
                }">
                  {{ metric.status }}
                </span>
              </div>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                {{ metric.description }}
              </p>
            </div>
          </div>

          <div v-if="metric.metrics" class="mt-4">
            <dl class="grid gap-4" :class="{
              'grid-cols-3': metric.metrics.length === 3,
              'grid-cols-2': metric.metrics.length === 2,
              'grid-cols-1': metric.metrics.length === 1
            }">
              <div v-for="m in metric.metrics" :key="m.label"
                   class="overflow-hidden rounded-lg bg-gray-50 px-4 py-3 dark:bg-blue-gray-700">
                <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">
                  {{ m.label }}
                </dt>
                <dd class="mt-1 text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  {{ m.value }}
                </dd>
              </div>
            </dl>
          </div>

          <div v-if="metric.exceptionList" class="mt-4 space-y-4">
            <div v-for="exception in metric.exceptionList" :key="exception.name"
                 class="relative">
              <div class="flex justify-between">
                <div class="flex-1">
                  <p class="font-mono text-sm text-gray-900 dark:text-gray-100">{{ exception.name }}</p>
                  <p class="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">{{ exception.path }}</p>
                </div>
                <div class="ml-4 flex flex-col items-end">
                  <span class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ exception.count }}</span>
                  <span class="text-sm text-gray-500 dark:text-gray-400">{{ exception.time }}</span>
                </div>
              </div>
              <div class="absolute -left-2 top-2 w-0.5 h-full bg-red-500 dark:bg-red-400"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-badge {
  @apply inline-flex items-center px-3 py-1 rounded-full text-sm font-medium;
}
.status-badge.success {
  @apply bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100;
}
.status-badge.warning {
  @apply bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100;
}
.status-badge.error {
  @apply bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100;
}
</style>
