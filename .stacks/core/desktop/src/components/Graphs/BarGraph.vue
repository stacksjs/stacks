<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const chartData: any = {
  labels: ['January', 'February', 'March'],
  datasets: [{
    data: [40, 20, 12],
    label: '# of Users',
    borderColor: '#36A2EB',
    backgroundColor: '#9BD0F5',
  }],
}

const chartOptions: any = {
  responsive: true,
  scales: {
    y: {
      beginAtZero: true,
    },
  },
}
</script>

<template>
  <Bar
    id="my-chart-id"
    :options="chartOptions"
    :data="chartData"
  />
</template>
