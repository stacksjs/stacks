<script lang="ts" setup>
import { useDateFormat } from '@vueuse/core'
import { useHealthStore } from '~/stores/health'

const healthStore = useHealthStore()
const dateRange = ref([])
const loading = ref(true)

const chartData = ref({
  labels: [] as any[],
  datasets: [
    {
      label: 'Performance',
      color: '#22d3ee',
      borderColor: '#22d3ee',
      backgroundColor: 'transparent',
      data: [] as any[],
    },
  ],
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      callbacks: {
        label(context: any) {
          const label = context.formattedValue || ''

          return `${label} ms`
        },
      },
    },
  },
  scales: {
    y: {
      suggestedMin: 0, // minimum will be 0, unless there is a lower value.
      suggestedMax: 1000, // minimum will be 0, unless there is a lower value.
      beginAtZero: true, // minimum value will be 0.
      ticks: {
        callback(value: number | string, index: number, ticks: any) {
          return `${value}ms`
        },
      },

    },
  },
}

onMounted(async () => {
  await healthStore.fetchPerformanceRecords({})

  fillData()

  loading.value = false
})

const performanceDates = computed(() => {
  return healthStore.performanceRecords.map((performance: any) => {
    return performance.createdAt.split(' ')[1]
  })
})

const timePerformance = computed(() => {
  return healthStore.performanceRecords.map((performance) => {
    const total = performance.timeTotal * 1000

    return total.toFixed(2)
  })
})

function fillData() {
  chartData.value = {
    labels: performanceDates.value,
    datasets: [
      {
        label: 'Performance',
        color: '#22d3ee',
        borderColor: '#22d3ee',
        backgroundColor: 'transparent',
        data: timePerformance.value,
      },
    ],
  }
}

async function filterPerformance() {
  const startDate = useDateFormat(dateRange.value[0], 'YYYY-MM-DD')
  const endDate = useDateFormat(dateRange.value[1], 'YYYY-MM-DD')

  await healthStore.fetchPerformanceRecords({ startDate: startDate.value, endDate: endDate.value })

  fillData()
}
</script>

<template>
  <div class="dark:border-gray-600">
    <h3 class="font-semibold">
      Performance
    </h3>
  </div>

  <el-date-picker
    v-model="dateRange"
    type="daterange"
    range-separator="To"
    start-placeholder="Start date"
    end-placeholder="End date"
    size="default"
    @change="filterPerformance"
  />

  <div
    class="mt-4 bg-white rounded-lg shadow dark:bg-gray-700"
  >
    <div class="p-4 mx-auto dark:bg-gray-600 lg:max-w-5xl">
      <SectionLoader
        v-if="loading"
        :height="30"
      />
      <LineGraph
        v-if="chartData.labels.length && !loading"
        :chart-data="chartData"
        :chart-options="chartOptions"
        title="Performance in the last hour"
      />
    </div>

    <div
      v-if="!chartData.labels.length && !loading"
      class="mt-8 text-center"
    >
      No performance records found in this timeframe.
    </div>
  </div>
</template>
