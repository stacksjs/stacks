<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref } from 'vue'
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
  title: 'Dashboard - Commerce',
})

// Sample data for the dashboard
const revenueData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  datasets: [
    {
      label: 'Revenue',
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(59, 130, 246, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
      fill: true,
      tension: 0.4,
      data: [30000, 35000, 32000, 40000, 45000, 43000, 50000, 55000, 58000, 56000, 60000, 65000],
    },
  ],
}

const ordersData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  datasets: [
    {
      label: 'Orders',
      backgroundColor: 'rgba(16, 185, 129, 0.8)',
      borderColor: 'rgba(16, 185, 129, 1)',
      borderWidth: 1,
      borderRadius: 4,
      data: [120, 150, 140, 160, 180, 170, 190, 210, 230, 220, 240, 260],
    },
  ],
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.05)',
      },
    },
    x: {
      grid: {
        display: false,
      },
    },
  },
}

const topProducts = [
  { id: 1, name: 'Premium Headphones', price: '$199.99', sales: 1245, stock: 78 },
  { id: 2, name: 'Wireless Keyboard', price: '$89.99', sales: 987, stock: 124 },
  { id: 3, name: 'Smart Watch', price: '$249.99', sales: 876, stock: 45 },
  { id: 4, name: 'Bluetooth Speaker', price: '$129.99', sales: 765, stock: 92 },
  { id: 5, name: 'USB-C Hub', price: '$59.99', sales: 654, stock: 210 },
]

const recentOrders = [
  { id: '#ORD-5432', customer: 'John Smith', date: '2023-12-01', total: '$349.97', status: 'Completed' },
  { id: '#ORD-5431', customer: 'Sarah Johnson', date: '2023-12-01', total: '$129.99', status: 'Processing' },
  { id: '#ORD-5430', customer: 'Michael Brown', date: '2023-11-30', total: '$459.98', status: 'Completed' },
  { id: '#ORD-5429', customer: 'Emily Davis', date: '2023-11-30', total: '$89.99', status: 'Shipped' },
  { id: '#ORD-5428', customer: 'David Wilson', date: '2023-11-29', total: '$199.99', status: 'Completed' },
]

const timeRange = ref('Last 30 days')
const timeRanges = ['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Last year', 'All time']
</script>

<template>
  <main>
    <div class="relative isolate overflow-hidden">
      <div class="px-6 py-6 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-7xl">
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Commerce Dashboard</h1>

          <!-- Time range selector -->
          <div class="mt-4 flex items-center justify-between">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Overview of your store's performance
            </p>
            <div class="relative">
              <select v-model="timeRange" class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700">
                <option v-for="range in timeRanges" :key="range" :value="range">{{ range }}</option>
              </select>
            </div>
          </div>

          <!-- Stats -->
          <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Revenue</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">$548,290</dd>
              <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
                <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
                <span>12.5% increase</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Orders</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">2,456</dd>
              <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
                <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
                <span>8.2% increase</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Average Order Value</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">$223.25</dd>
              <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
                <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
                <span>3.7% increase</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Conversion Rate</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">3.6%</dd>
              <dd class="mt-2 flex items-center text-sm text-red-600 dark:text-red-400">
                <div class="i-hugeicons-analytics-down h-4 w-4 mr-1"></div>
                <span>0.8% decrease</span>
              </dd>
            </div>
          </dl>

          <!-- Charts -->
          <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="p-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Revenue</h3>
                <div class="mt-2 h-80">
                  <Line :data="revenueData" :options="chartOptions" />
                </div>
              </div>
            </div>

            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="p-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Orders</h3>
                <div class="mt-2 h-80">
                  <Bar :data="ordersData" :options="chartOptions" />
                </div>
              </div>
            </div>
          </div>

          <!-- Top Products -->
          <div class="mt-8">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:px-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Top Selling Products</h3>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Product</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Price</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Sales</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Stock</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200 dark:bg-blue-gray-800 dark:divide-gray-700">
                    <tr v-for="product in topProducts" :key="product.id">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{{ product.name }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ product.price }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ product.sales }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ product.stock }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Recent Orders -->
          <div class="mt-8">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:px-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Recent Orders</h3>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Order ID</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Customer</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Date</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Total</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200 dark:bg-blue-gray-800 dark:divide-gray-700">
                    <tr v-for="order in recentOrders" :key="order.id">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{{ order.id }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ order.customer }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ order.date }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ order.total }}</td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                              :class="{
                                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': order.status === 'Completed',
                                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300': order.status === 'Processing',
                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300': order.status === 'Shipped'
                              }">
                          {{ order.status }}
                        </span>
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
  </main>
</template>
