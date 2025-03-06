<script lang="ts" setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useHead } from '@vueuse/head'
import { Chart, registerables, ChartTypeRegistry } from 'chart.js'

// Register Chart.js components
Chart.register(...registerables)

useHead({
  title: 'Dashboard - Commerce Marketing Analytics',
})

// Types
interface DateRange {
  id: string
  name: string
}

interface CampaignData {
  name: string
  id: string
  spend: number
  revenue: number
  roi: number
  conversions: number
  percentage: number
}

interface ChannelData {
  name: string
  spend: number
  revenue: number
  roi: number
  conversions: number
  percentage: number
}

interface AdData {
  name: string
  id: string
  impressions: number
  clicks: number
  ctr: number
  conversions: number
  cpa: number
  percentage: number
}

// Date range options
const dateRanges: DateRange[] = [
  { id: 'last7days', name: 'Last 7 Days' },
  { id: 'last30days', name: 'Last 30 Days' },
  { id: 'thisMonth', name: 'This Month' },
  { id: 'lastMonth', name: 'Last Month' },
  { id: 'thisYear', name: 'This Year' },
  { id: 'custom', name: 'Custom Range' }
]

// Selected date range
const selectedDateRange = ref('all-time')
const dateRangeDisplay = ref('All Time: Sep 7, 2023 to Mar 6, 2025')
const comparisonType = ref('no-comparison')
const customStartDate = ref('')
const customEndDate = ref('')
const showCustomDateRange = computed(() => selectedDateRange.value === 'custom')

// Marketing overview data
const marketingOverview = ref({
  totalSpend: 125000,
  totalRevenue: 375000,
  roi: 200,
  conversions: 7500,
  cpa: 16.67,
  conversionRate: '3.2%'
})

// Marketing data for chart
const marketingData = ref([
  { date: '2023-11-01', spend: 5000, revenue: 15000 },
  { date: '2023-12-01', spend: 6000, revenue: 18000 },
  { date: '2024-01-01', spend: 7000, revenue: 21000 },
  { date: '2024-02-01', spend: 8000, revenue: 24000 },
  { date: '2024-03-01', spend: 10000, revenue: 30000 },
  { date: '2024-04-01', spend: 9000, revenue: 27000 },
  { date: '2024-05-01', spend: 8000, revenue: 24000 },
  { date: '2024-06-01', spend: 7000, revenue: 21000 },
  { date: '2024-07-01', spend: 8000, revenue: 24000 },
  { date: '2024-08-01', spend: 7000, revenue: 21000 },
  { date: '2024-09-01', spend: 7000, revenue: 21000 },
  { date: '2024-10-01', spend: 8000, revenue: 24000 },
  { date: '2024-11-01', spend: 6000, revenue: 18000 },
  { date: '2024-12-01', spend: 12000, revenue: 36000 },
  { date: '2025-01-01', spend: 7000, revenue: 21000 },
  { date: '2025-02-01', spend: 5000, revenue: 15000 }
])

// Chart.js configuration
const chartConfig = reactive({
  type: 'line' as keyof ChartTypeRegistry,
  data: {
    labels: marketingData.value.map(item => item.date),
    datasets: [
      {
        label: 'Revenue ($)',
        data: marketingData.value.map(item => item.revenue),
        backgroundColor: 'rgba(16, 185, 129, 0.3)',
        borderColor: 'rgba(16, 185, 129, 0.8)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        yAxisID: 'y'
      },
      {
        label: 'Spend ($)',
        data: marketingData.value.map(item => item.spend),
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        borderColor: 'rgba(244, 63, 94, 0.8)',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        yAxisID: 'y'
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxTicksLimit: 4,
          callback: function(value: any, index: number) {
            const labels = ['Jan 2024', 'May 2024', 'Sep 2024', 'Jan 2025']
            return index % Math.floor(marketingData.value.length / 4) === 0 ? labels[Math.floor(index / (marketingData.value.length / 4))] || '' : ''
          }
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        beginAtZero: true,
        grid: {
          borderDash: [2, 4],
          color: 'rgba(160, 174, 192, 0.2)'
        },
        ticks: {
          maxTicksLimit: 6,
          callback: function(value: any) {
            return '$' + value.toLocaleString()
          }
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += '$' + context.parsed.y.toLocaleString();
            return label;
          }
        }
      }
    }
  }
})

// Campaigns data
const campaignsData = ref<CampaignData[]>([
  { name: 'Summer Sale 2024', id: 'SUMMER24', spend: 25000, revenue: 75000, roi: 200, conversions: 1500, percentage: 0 },
  { name: 'New Product Launch', id: 'NEWPROD', spend: 20000, revenue: 60000, roi: 200, conversions: 1200, percentage: 0 },
  { name: 'Holiday Special', id: 'HOLIDAY', spend: 18000, revenue: 54000, roi: 200, conversions: 1080, percentage: 0 },
  { name: 'Back to School', id: 'SCHOOL', spend: 15000, revenue: 45000, roi: 200, conversions: 900, percentage: 0 },
  { name: 'Flash Sale', id: 'FLASH', spend: 12000, revenue: 36000, roi: 200, conversions: 720, percentage: 0 },
  { name: 'Loyalty Program', id: 'LOYALTY', spend: 10000, revenue: 30000, roi: 200, conversions: 600, percentage: 0 },
  { name: 'Referral Program', id: 'REFERRAL', spend: 8000, revenue: 24000, roi: 200, conversions: 480, percentage: 0 },
  { name: 'Email Newsletter', id: 'EMAIL', spend: 7000, revenue: 21000, roi: 200, conversions: 420, percentage: 0 },
  { name: 'Retargeting Campaign', id: 'RETARGET', spend: 6000, revenue: 18000, roi: 200, conversions: 360, percentage: 0 },
  { name: 'Social Media Contest', id: 'CONTEST', spend: 4000, revenue: 12000, roi: 200, conversions: 240, percentage: 0 }
])

// Calculate percentages for campaigns based on revenue
const totalCampaignRevenue = computed(() => campaignsData.value.reduce((sum, campaign) => sum + campaign.revenue, 0))
// Update percentages
campaignsData.value.forEach(campaign => {
  campaign.percentage = Math.round((campaign.revenue / totalCampaignRevenue.value) * 100)
})

// Channels data
const channelsData = ref<ChannelData[]>([
  { name: 'Paid Search', spend: 35000, revenue: 105000, roi: 200, conversions: 2100, percentage: 0 },
  { name: 'Social Media', spend: 30000, revenue: 90000, roi: 200, conversions: 1800, percentage: 0 },
  { name: 'Email Marketing', spend: 20000, revenue: 60000, roi: 200, conversions: 1200, percentage: 0 },
  { name: 'Display Ads', spend: 15000, revenue: 45000, roi: 200, conversions: 900, percentage: 0 },
  { name: 'Affiliate Marketing', spend: 10000, revenue: 30000, roi: 200, conversions: 600, percentage: 0 },
  { name: 'Influencer Marketing', spend: 8000, revenue: 24000, roi: 200, conversions: 480, percentage: 0 },
  { name: 'Content Marketing', spend: 5000, revenue: 15000, roi: 200, conversions: 300, percentage: 0 },
  { name: 'SMS Marketing', spend: 2000, revenue: 6000, roi: 200, conversions: 120, percentage: 0 }
])

// Calculate percentages for channels based on revenue
const totalChannelRevenue = computed(() => channelsData.value.reduce((sum, channel) => sum + channel.revenue, 0))
// Update percentages
channelsData.value.forEach(channel => {
  channel.percentage = Math.round((channel.revenue / totalChannelRevenue.value) * 100)
})

// Top performing ads data
const adsData = ref<AdData[]>([
  { name: 'Summer Sale Banner', id: 'AD-001', impressions: 250000, clicks: 12500, ctr: 5, conversions: 625, cpa: 16, percentage: 0 },
  { name: 'Product Showcase Video', id: 'AD-002', impressions: 200000, clicks: 10000, ctr: 5, conversions: 500, cpa: 16, percentage: 0 },
  { name: 'Limited Time Offer', id: 'AD-003', impressions: 180000, clicks: 9000, ctr: 5, conversions: 450, cpa: 16, percentage: 0 },
  { name: 'Customer Testimonial', id: 'AD-004', impressions: 150000, clicks: 7500, ctr: 5, conversions: 375, cpa: 16, percentage: 0 },
  { name: 'Free Shipping Promo', id: 'AD-005', impressions: 120000, clicks: 6000, ctr: 5, conversions: 300, cpa: 16, percentage: 0 }
])

// Calculate percentages for ads based on conversions
const totalAdConversions = computed(() => adsData.value.reduce((sum, ad) => sum + ad.conversions, 0))
// Update percentages
adsData.value.forEach(ad => {
  ad.percentage = Math.round((ad.conversions / totalAdConversions.value) * 100)
})

// Format numbers with commas
function formatNumber(number: number): string {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Format currency
function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Format percentage
function formatPercentage(value: number): string {
  return value.toFixed(1) + '%'
}

// Initialize chart when component is mounted
let marketingChart: Chart | null = null

onMounted(() => {
  const ctx = document.getElementById('marketingChart') as HTMLCanvasElement
  if (ctx) {
    marketingChart = new Chart(ctx, chartConfig)
  }
})
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header with date range selector -->
        <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center space-x-2">
            <div class="i-hugeicons-calendar-03 h-5 w-5 text-gray-500 dark:text-gray-400"></div>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ dateRangeDisplay }}</span>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">compared to</span>

            <div class="relative">
              <select
                v-model="comparisonType"
                class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option value="no-comparison">No comparison</option>
                <option value="previous-period">Previous period</option>
                <option value="previous-year">Previous year</option>
              </select>
            </div>

            <button
              type="button"
              class="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              <div class="i-hugeicons-settings-01 h-4 w-4 mr-1"></div>
              Auto
            </button>
          </div>
        </div>

        <!-- Overview Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8 bg-black dark:bg-blue-gray-900 rounded-lg p-4">
          <!-- Total Spend -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">$125k</div>
            <div class="text-sm text-gray-400">Total Spend</div>
          </div>

          <!-- Total Revenue -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">$375k</div>
            <div class="text-sm text-gray-400">Total Revenue</div>
          </div>

          <!-- ROI -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">{{ marketingOverview.roi }}%</div>
            <div class="text-sm text-gray-400">ROI</div>
          </div>

          <!-- Conversions -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">7.5k</div>
            <div class="text-sm text-gray-400">Conversions</div>
          </div>

          <!-- CPA -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">${{ marketingOverview.cpa.toFixed(2) }}</div>
            <div class="text-sm text-gray-400">Cost Per Acquisition</div>
          </div>

          <!-- Conversion Rate -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">{{ marketingOverview.conversionRate }}</div>
            <div class="text-sm text-gray-400">Conversion Rate</div>
          </div>
        </div>

        <!-- Marketing Chart -->
        <div class="mb-8 bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
          <!-- Chart header -->
          <div class="mb-4">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Marketing Performance</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Revenue vs. marketing spend over time
            </p>
          </div>

          <!-- Chart.js canvas -->
          <div class="h-80 w-full">
            <canvas id="marketingChart"></canvas>
          </div>
        </div>

        <!-- Data Tables -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Campaigns Table -->
          <div>
            <div class="mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Campaigns</h3>
            </div>

            <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                  <tr>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Campaign
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Spend
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Revenue
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      ROI
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="(campaign, index) in campaignsData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div class="absolute inset-0 bg-rose-100/50 dark:bg-rose-900/50" :style="{ width: campaign.percentage + '%' }"></div>
                      <span class="relative z-10">{{ campaign.name }}</span>
                      <span class="relative z-10 text-xs text-gray-500 dark:text-gray-400 block">{{ campaign.id }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ formatCurrency(campaign.spend) }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ formatCurrency(campaign.revenue) }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ campaign.roi }}%</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ campaign.percentage }}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 flex justify-end">
              <a href="/dashboard/commerce/analytics/marketing/campaigns" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all campaigns
              </a>
            </div>
          </div>

          <!-- Channels Table -->
          <div>
            <div class="mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Channels</h3>
            </div>

            <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                  <tr>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Channel
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Spend
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Revenue
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      ROI
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="(channel, index) in channelsData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div class="absolute inset-0 bg-blue-100/50 dark:bg-blue-900/50" :style="{ width: channel.percentage + '%' }"></div>
                      <span class="relative z-10">{{ channel.name }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ formatCurrency(channel.spend) }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ formatCurrency(channel.revenue) }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ channel.roi }}%</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ channel.percentage }}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 flex justify-end">
              <a href="/dashboard/commerce/analytics/marketing/channels" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all channels
              </a>
            </div>
          </div>
        </div>

        <!-- Top Performing Ads -->
        <div class="mt-8">
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Top Performing Ads</h3>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Ad
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Impressions
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Clicks
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    CTR
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Conversions
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    CPA
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    %
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                <tr v-for="(ad, index) in adsData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div class="absolute inset-0 bg-purple-100/50 dark:bg-purple-900/50" :style="{ width: ad.percentage + '%' }"></div>
                    <span class="relative z-10">{{ ad.name }}</span>
                    <span class="relative z-10 text-xs text-gray-500 dark:text-gray-400 block">{{ ad.id }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ formatNumber(ad.impressions) }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ formatNumber(ad.clicks) }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ ad.ctr }}%</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ formatNumber(ad.conversions) }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">${{ ad.cpa }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ ad.percentage }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-2 flex justify-end">
            <a href="/dashboard/commerce/analytics/marketing/ads" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
              View all ads
            </a>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.commerce-marketing {
  @apply space-y-6;
}
</style>
