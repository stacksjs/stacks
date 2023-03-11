<script lang="ts" setup>
import { Line } from 'vue-chartjs'
import { CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Title, Tooltip } from 'chart.js'

interface Props {
  title: string
  chartOptions: any
  chartData: any
}

const {
  chartOptions,
  chartData,
} = defineProps<Props>()

ChartJS.register(Title, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement)
</script>

<template>
  <div>
    <Line
      :options="chartOptions"
      :data="chartData"
      :height="500"
    />
  </div>
</template>
