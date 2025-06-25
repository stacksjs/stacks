<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref } from 'vue'
import { useHead } from '@vueuse/head'
import { Line, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
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
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

useHead({
  title: 'Dashboard - Blog',
})

// Sample data for the dashboard
const viewsData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  datasets: [
    {
      label: 'Page Views',
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(59, 130, 246, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
      fill: true,
      tension: 0.4,
      data: [12500, 14200, 13800, 15600, 16800, 16200, 17500, 18200, 19100, 18600, 20100, 21500],
    },
  ],
}

const categoryData = {
  labels: ['Technology', 'Tutorials', 'News', 'Reviews', 'Opinion'],
  datasets: [
    {
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(139, 92, 246, 0.8)',
      ],
      borderColor: [
        'rgba(59, 130, 246, 1)',
        'rgba(16, 185, 129, 1)',
        'rgba(245, 158, 11, 1)',
        'rgba(239, 68, 68, 1)',
        'rgba(139, 92, 246, 1)',
      ],
      borderWidth: 1,
      data: [35, 25, 20, 15, 5],
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

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: {
        boxWidth: 15,
        padding: 15,
      },
    },
  },
}

const topPosts = [
  { id: 1, title: '10 Tips for Better Code Quality', category: 'Tutorials', views: 12450, comments: 78, published: '2023-12-01', status: 'Published' },
  { id: 2, title: 'The Future of JavaScript Frameworks', category: 'Technology', views: 9870, comments: 124, published: '2023-11-28', status: 'Published' },
  { id: 3, title: 'Getting Started with Vue 3', category: 'Tutorials', views: 8760, comments: 45, published: '2023-11-25', status: 'Published' },
  { id: 4, title: 'Review: Latest MacBook Pro', category: 'Reviews', views: 7650, comments: 92, published: '2023-11-20', status: 'Published' },
  { id: 5, title: 'Understanding Web Accessibility', category: 'Tutorials', views: 6540, comments: 31, published: '2023-11-15', status: 'Published' },
]

const recentComments = [
  { id: 1, author: 'John Smith', email: 'john.smith@example.com', content: 'Great article! This helped me solve a problem I\'ve been stuck on for days.', post: '10 Tips for Better Code Quality', date: '2023-12-01', status: 'Approved' },
  { id: 2, author: 'Sarah Johnson', email: 'sarah.j@example.com', content: 'I disagree with point #3. In my experience, that approach causes more problems than it solves.', post: 'The Future of JavaScript Frameworks', date: '2023-12-01', status: 'Pending' },
  { id: 3, author: 'Michael Brown', email: 'mbrown@example.com', content: 'Thanks for the tutorial! Could you elaborate more on the setup process?', post: 'Getting Started with Vue 3', date: '2023-11-30', status: 'Approved' },
  { id: 4, author: 'Emily Davis', email: 'emily.davis@example.com', content: 'I found a typo in the third paragraph. It should be "their" not "there".', post: '10 Tips for Better Code Quality', date: '2023-11-30', status: 'Approved' },
  { id: 5, author: 'David Wilson', email: 'dwilson@example.com', content: 'This review seems biased. Have you tried comparing it with the competition?', post: 'Review: Latest MacBook Pro', date: '2023-11-29', status: 'Spam' },
]

const draftPosts = [
  { id: 6, title: 'Introduction to TypeScript', category: 'Tutorials', lastEdited: '2023-12-01', author: 'Jane Doe' },
  { id: 7, title: 'Building a REST API with Node.js', category: 'Tutorials', lastEdited: '2023-11-29', author: 'John Smith' },
  { id: 8, title: 'CSS Grid vs Flexbox', category: 'Tutorials', lastEdited: '2023-11-27', author: 'Jane Doe' },
]

const timeRange = ref('Last 30 days')
const timeRanges = ['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Last year', 'All time']

// Stats calculations
const totalPosts = 127
const totalViews = 256890
const totalComments = 3427
const averageEngagement = '4.2%'
</script>

<template>
  <main>
    <div class="relative isolate overflow-hidden">
      <div class="px-6 py-6 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-7xl">
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Content Dashboard</h1>

          <!-- Time range selector -->
          <div class="mt-4 flex items-center justify-between">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Overview of your blog's performance
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
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Posts</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ totalPosts }}</dd>
              <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
                <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
                <span>5.2% increase</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Views</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ totalViews.toLocaleString() }}</dd>
              <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
                <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
                <span>8.1% increase</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Comments</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ totalComments.toLocaleString() }}</dd>
              <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
                <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
                <span>12.3% increase</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Avg. Engagement</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ averageEngagement }}</dd>
              <dd class="mt-2 flex items-center text-sm text-red-600 dark:text-red-400">
                <div class="i-hugeicons-analytics-down h-4 w-4 mr-1"></div>
                <span>0.5% decrease</span>
              </dd>
            </div>
          </dl>

          <!-- Charts -->
          <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="p-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Page Views</h3>
                <div class="mt-2 h-80">
                  <Line :data="viewsData" :options="chartOptions" />
                </div>
              </div>
            </div>

            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="p-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Content Categories</h3>
                <div class="mt-2 h-80">
                  <Doughnut :data="categoryData" :options="doughnutOptions" />
                </div>
              </div>
            </div>
          </div>

          <!-- Top Posts -->
          <div class="mt-8">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Top Performing Posts</h3>
                <button type="button" class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                  <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
                  New Post
                </button>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Title</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Category</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Views</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Comments</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Published</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Status</th>
                      <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200 dark:bg-blue-gray-800 dark:divide-gray-700">
                    <tr v-for="post in topPosts" :key="post.id">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{{ post.title }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ post.category }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ post.views.toLocaleString() }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ post.comments }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ post.published }}</td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                          {{ post.status }}
                        </span>
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div class="flex items-center justify-end space-x-2">
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-view h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                            <div class="i-hugeicons-waste h-5 w-5"></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Recent Comments and Draft Posts -->
          <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <!-- Recent Comments -->
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Recent Comments</h3>
                <div class="flex space-x-2">
                  <div class="relative">
                    <select class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700">
                      <option>All comments</option>
                      <option>Approved</option>
                      <option>Pending</option>
                      <option>Spam</option>
                    </select>
                  </div>
                  <button type="button" class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600">
                    <div class="i-hugeicons-refresh h-4 w-4 mr-1"></div>
                    Refresh
                  </button>
                </div>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700">
                <ul role="list" class="divide-y divide-gray-200 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
                  <li v-for="comment in recentComments" :key="comment.id" class="px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-blue-gray-700 transition duration-150">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center">
                        <div class="flex-shrink-0">
                          <div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <div class="i-hugeicons-user-01 h-6 w-6 text-gray-500 dark:text-gray-400"></div>
                          </div>
                        </div>
                        <div class="ml-4">
                          <div class="font-medium text-gray-900 dark:text-white flex items-center">
                            {{ comment.author }}
                            <span v-if="comment.id <= 2" class="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-400/30">New</span>
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-400">{{ comment.email }}</div>
                        </div>
                      </div>
                      <div>
                        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                              :class="{
                                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': comment.status === 'Approved',
                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300': comment.status === 'Pending',
                                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300': comment.status === 'Spam'
                              }">
                          {{ comment.status }}
                        </span>
                      </div>
                    </div>
                    <div class="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      <p>{{ comment.content }}</p>
                    </div>
                    <div class="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center">
                      <div class="i-hugeicons-document-text h-4 w-4 mr-1"></div>
                      <p>On: <a href="#" class="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">{{ comment.post }}</a> • <span class="whitespace-nowrap">{{ comment.date }}</span></p>
                    </div>
                    <div class="mt-2 flex space-x-2">
                      <button v-if="comment.status !== 'Approved'" type="button" class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600">
                        <div class="i-hugeicons-checkmark-circle-02 h-4 w-4 mr-1"></div>
                        Approve
                      </button>
                      <button type="button" class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600">
                        <div class="i-hugeicons-edit-01 h-4 w-4 mr-1"></div>
                        Reply
                      </button>
                      <button type="button" class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600">
                        <div class="i-hugeicons-waste h-4 w-4 mr-1"></div>
                        Delete
                      </button>
                    </div>
                  </li>
                </ul>
                <div class="bg-gray-50 px-4 py-4 sm:px-6 dark:bg-blue-gray-700 flex justify-between items-center">
                  <a href="#" class="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">View all comments<span aria-hidden="true"> &rarr;</span></a>
                  <div class="text-sm text-gray-500 dark:text-gray-400">Showing 5 of 42 comments</div>
                </div>
              </div>
            </div>

            <!-- Draft Posts -->
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Draft Posts</h3>
                <button type="button" class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                  <div class="i-hugeicons-plus-sign h-4 w-4 mr-1"></div>
                  New Draft
                </button>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700">
                <ul role="list" class="divide-y divide-gray-200 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
                  <li v-for="post in draftPosts" :key="post.id" class="px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-blue-gray-700 transition duration-150">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="font-medium text-gray-900 dark:text-white flex items-center">
                          {{ post.title }}
                          <span v-if="post.id === 6" class="ml-2 inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/30">Updated today</span>
                        </div>
                        <div class="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <div class="i-hugeicons-folder-01 h-4 w-4 mr-1"></div>
                          <span>{{ post.category }}</span>
                          <span class="mx-2">&middot;</span>
                          <div class="i-hugeicons-user-01 h-4 w-4 mr-1"></div>
                          <span>{{ post.author }}</span>
                          <span v-if="post.id === 7" class="ml-2 inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400 dark:ring-yellow-500/30">Needs review</span>
                        </div>
                      </div>
                      <div class="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                        <div class="i-hugeicons-calendar h-4 w-4 mr-1"></div>
                        Last edited: {{ post.lastEdited }}
                      </div>
                    </div>
                    <div class="mt-3 w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                      <div class="bg-blue-600 h-1.5 rounded-full" :style="{width: post.id === 6 ? '90%' : post.id === 7 ? '65%' : '40%'}"></div>
                    </div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
                      {{ post.id === 6 ? 'Almost ready' : post.id === 7 ? 'In progress' : 'Just started' }}
                    </div>
                    <div class="mt-2 flex space-x-2">
                      <button type="button" class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600">
                        <div class="i-hugeicons-edit-01 h-4 w-4 mr-1"></div>
                        Edit
                      </button>
                      <button type="button" class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600">
                        <div class="i-hugeicons-view h-4 w-4 mr-1"></div>
                        Preview
                      </button>
                      <button type="button" class="inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                        <div class="i-hugeicons-paper-plane h-4 w-4 mr-1"></div>
                        Publish
                      </button>
                    </div>
                  </li>
                </ul>
                <div class="bg-gray-50 px-4 py-4 sm:px-6 dark:bg-blue-gray-700 flex justify-between items-center">
                  <a href="#" class="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">View all drafts<span aria-hidden="true"> &rarr;</span></a>
                  <div class="text-sm text-gray-500 dark:text-gray-400">Showing 3 of 12 drafts</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

