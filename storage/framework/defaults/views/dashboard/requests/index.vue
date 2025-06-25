<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { useHead } from '@vueuse/head'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

useHead({
  title: 'Dashboard - Requests',
})

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(200, 200, 200, 0.1)',
      },
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
      },
    },
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
      },
    },
  },
  plugins: {
    legend: {
      display: true,
      labels: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
      },
    },
  },
  elements: {
    line: {
      tension: 0.4,
    },
  },
}

// Mock data for charts
const requestVolumeData = {
  labels: ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'],
  datasets: [
    {
      label: 'Requests',
      data: [1200, 1900, 800, 1600, 2400, 2100, 1800, 2200],
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'rgb(59, 130, 246)',
      fill: true,
    }
  ]
}

const responseTimeData = {
  labels: ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'],
  datasets: [
    {
      label: 'Average',
      data: [320, 280, 300, 390, 420, 350, 360, 380],
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: false,
    },
    {
      label: 'p95',
      data: [480, 420, 450, 580, 630, 525, 540, 570],
      borderColor: 'rgb(147, 197, 253)',
      backgroundColor: 'rgba(147, 197, 253, 0.1)',
      fill: false,
    }
  ]
}

const successRateData = {
  labels: ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'],
  datasets: [
    {
      label: 'Success Rate',
      data: [98, 97, 99, 96, 95, 97, 98, 96],
      borderColor: 'rgb(34, 197, 94)',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      fill: true,
    },
    {
      label: 'Error Rate',
      data: [2, 3, 1, 4, 5, 3, 2, 4],
      borderColor: 'rgb(239, 68, 68)',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: true,
    }
  ]
}

const statusCodesData = {
  labels: ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'],
  datasets: [
    {
      label: '2xx',
      data: [980, 970, 990, 960, 950, 970, 980, 960],
      backgroundColor: 'rgba(34, 197, 94, 0.7)',
    },
    {
      label: '3xx',
      data: [15, 20, 8, 25, 30, 20, 15, 25],
      backgroundColor: 'rgba(234, 179, 8, 0.7)',
    },
    {
      label: '4xx/5xx',
      data: [5, 10, 2, 15, 20, 10, 5, 15],
      backgroundColor: 'rgba(239, 68, 68, 0.7)',
    }
  ]
}

const barChartOptions = {
  ...chartOptions,
  scales: {
    ...chartOptions.scales,
    x: {
      ...chartOptions.scales.x,
      stacked: true,
    },
    y: {
      ...chartOptions.scales.y,
      stacked: true,
    },
  },
}
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 font-semibold leading-6 dark:text-gray-100">
          Last 30 days
        </h3>

        <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-blue-gray-700">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-global h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Total Requests
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold dark:text-gray-100">
                71,897
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 dark:text-green-400 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                122
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-blue-gray-700">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-clock-01 h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Avg. Request Time
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold dark:text-gray-100">
                365 ms
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 dark:text-green-400 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                12 s
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-blue-gray-700">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-checkmark-circle-02 h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Success Rate
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold dark:text-gray-100">
                94.57%
              </p>

              <p class="ml-2 flex items-baseline text-sm text-red-600 dark:text-red-400 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Decreased by </span>
                3.2%
              </p>

              <!-- <div class="absolute inset-x-0 bottom-0 bg-gray-50 px-4 py-4 sm:px-6">
                <div class="text-sm">
                  <a href="#" class="font-medium text-blue-600 hover:text-blue-500">View all<span class="sr-only"> Success Rate</span></a>
                </div>
              </div> -->
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Graphs Section -->
    <div class="px-4 lg:px-8 sm:px-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Request Volume Graph -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Request Volume</h3>
            <div class="flex items-center space-x-4">
              <select class="text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-8 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600">
                <option>Last 24 hours</option>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
              </select>
            </div>
          </div>
          <div class="relative h-[300px]">
            <Line :data="requestVolumeData" :options="chartOptions" />
          </div>
        </div>

        <!-- Response Time Graph -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Response Time</h3>
          </div>
          <div class="relative h-[300px]">
            <Line :data="responseTimeData" :options="chartOptions" />
          </div>
        </div>

        <!-- Success Rate Graph -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Success Rate</h3>
          </div>
          <div class="relative h-[300px]">
            <Line :data="successRateData" :options="chartOptions" />
          </div>
        </div>

        <!-- Status Code Distribution -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Status Codes</h3>
          </div>
          <div class="relative h-[300px]">
            <Bar :data="statusCodesData" :options="barChartOptions" />
          </div>
        </div>
      </div>
    </div>

    <div class="px-4 pt-12 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
            Request History
          </h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            A list of all the requests that came in.
          </p>
        </div>

        <!-- <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            Deploy
          </button>
        </div> -->
      </div>

      <div class="mt-8 flow-root">
        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-gray-600 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                <thead class="bg-gray-50 dark:bg-blue-gray-700">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold sm:pl-6">
                      When
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Method
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Status
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Duration
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      IP Address
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold text-right">
                      Memory Usage
                    </th>

                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>

                <tbody class="bg-white dark:bg-blue-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 dark:text-gray-100 font-medium sm:pl-6">
                      05/04/2024 11:02:34<span class="text-gray-400 dark:text-gray-500">:123</span> AM UTC <em class="text-gray-400 dark:text-gray-500">(2 mins ago)</em>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      <span class="inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 font-medium ring-1 ring-slate-600/20 dark:ring-slate-500/20 ring-inset">
                        GET
                      </span>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                      <span class="inline-flex items-center rounded-md bg-green-50 dark:bg-green-900/20 px-2 py-1 text-xs text-green-700 dark:text-green-400 font-medium ring-1 ring-green-600/20 dark:ring-green-500/20 ring-inset">
                        Success
                      </span>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      16ms
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      127.0.0.1
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 text-right">
                      128MB
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">View<span class="sr-only">, Request</span></a>
                    </td>
                  </tr>

                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 dark:text-gray-100 font-medium sm:pl-6">
                      05/04/2024 11:01:34<span class="text-gray-400 dark:text-gray-500">:123</span> AM UTC <em class="text-gray-400 dark:text-gray-500">(3 mins ago)</em>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      <span class="inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 font-medium ring-1 ring-slate-600/20 dark:ring-slate-500/20 ring-inset">
                        POST
                      </span>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                      <span class="inline-flex items-center rounded-md bg-red-50 dark:bg-red-900/20 px-2 py-1 text-xs text-red-700 dark:text-red-400 font-medium ring-1 ring-red-600/20 dark:ring-red-500/20 ring-inset">
                        Error
                      </span>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      42ms
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      127.0.0.1
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 text-right">
                      98MB
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">View<span class="sr-only">, Request</span></a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
