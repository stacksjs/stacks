<script lang="ts" setup>
import { ref, reactive, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { Pie, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
)

useHead({
  title: 'Permissions - Management',
})

// Role form state
const showRoleModal = ref(false)
const roleForm = reactive({
  name: '',
  description: '',
  permissions: [] as number[],
})

// Permission form state
const showPermissionModal = ref(false)
const permissionForm = reactive({
  name: '',
  description: '',
})

// Sample data for the dashboard
const permissionsByRoleData = {
  labels: ['Admin', 'Manager', 'Editor', 'Viewer', 'Guest'],
  datasets: [
    {
      label: 'Permissions Count',
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(99, 102, 241, 0.8)',
        'rgba(236, 72, 153, 0.8)',
      ],
      borderColor: [
        'rgba(59, 130, 246, 1)',
        'rgba(16, 185, 129, 1)',
        'rgba(245, 158, 11, 1)',
        'rgba(99, 102, 241, 1)',
        'rgba(236, 72, 153, 1)',
      ],
      borderWidth: 1,
      data: [42, 28, 18, 12, 5],
    },
  ],
}

const permissionActivityData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  datasets: [
    {
      label: 'Permission Changes',
      backgroundColor: 'rgba(99, 102, 241, 0.8)',
      borderColor: 'rgba(99, 102, 241, 1)',
      borderWidth: 1,
      borderRadius: 4,
      data: [8, 12, 5, 18, 11, 9, 14, 22, 16, 10, 7, 13],
    },
  ],
}

const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: {
        boxWidth: 12,
      },
    },
  },
}

const barChartOptions = {
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

// Define interfaces for our data types
interface Role {
  id: number;
  name: string;
  description: string;
  users: number;
  lastUpdated: string;
}

interface Permission {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

// Roles data based on Spatie's permission package
const roles: Role[] = [
  { id: 1, name: 'admin', description: 'Full system access', users: 3, lastUpdated: '2023-12-01' },
  { id: 2, name: 'manager', description: 'Department management access', users: 8, lastUpdated: '2023-11-28' },
  { id: 3, name: 'editor', description: 'Content editing access', users: 15, lastUpdated: '2023-11-25' },
  { id: 4, name: 'viewer', description: 'Read-only access', users: 27, lastUpdated: '2023-11-20' },
  { id: 5, name: 'guest', description: 'Limited public access', users: 42, lastUpdated: '2023-11-15' },
]

// Permissions data based on Spatie's permission package
const permissions: Permission[] = [
  { id: 1, name: 'view users', description: 'View user profiles', created_at: '2023-11-01' },
  { id: 2, name: 'create users', description: 'Create new users', created_at: '2023-11-01' },
  { id: 3, name: 'edit users', description: 'Edit existing users', created_at: '2023-11-01' },
  { id: 4, name: 'delete users', description: 'Delete users', created_at: '2023-11-01' },
  { id: 5, name: 'view roles', description: 'View roles', created_at: '2023-11-01' },
  { id: 6, name: 'create roles', description: 'Create new roles', created_at: '2023-11-01' },
  { id: 7, name: 'edit roles', description: 'Edit existing roles', created_at: '2023-11-01' },
  { id: 8, name: 'delete roles', description: 'Delete roles', created_at: '2023-11-01' },
  { id: 9, name: 'view permissions', description: 'View permissions', created_at: '2023-11-01' },
  { id: 10, name: 'create permissions', description: 'Create new permissions', created_at: '2023-11-01' },
  { id: 11, name: 'edit permissions', description: 'Edit existing permissions', created_at: '2023-11-01' },
  { id: 12, name: 'delete permissions', description: 'Delete permissions', created_at: '2023-11-01' },
  { id: 13, name: 'view articles', description: 'View articles', created_at: '2023-11-01' },
  { id: 14, name: 'create articles', description: 'Create new articles', created_at: '2023-11-01' },
  { id: 15, name: 'edit articles', description: 'Edit existing articles', created_at: '2023-11-01' },
  { id: 16, name: 'delete articles', description: 'Delete articles', created_at: '2023-11-01' },
  { id: 17, name: 'publish articles', description: 'Publish articles', created_at: '2023-11-01' },
  { id: 18, name: 'unpublish articles', description: 'Unpublish articles', created_at: '2023-11-01' },
]

// Role-permission mappings
const rolePermissions: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], // admin has all permissions
  2: [1, 5, 9, 13, 14, 15, 16, 17, 18], // manager
  3: [1, 5, 9, 13, 14, 15, 17, 18], // editor
  4: [1, 5, 9, 13], // viewer
  5: [13], // guest
}

const recentPermissionChanges = [
  { id: '#PCH-1234', user: 'John Smith', role: 'editor', action: 'Added', resource: 'edit articles', date: '2023-12-01' },
  { id: '#PCH-1233', user: 'Sarah Johnson', role: 'admin', action: 'Removed', resource: 'delete users', date: '2023-12-01' },
  { id: '#PCH-1232', user: 'Michael Brown', role: 'manager', action: 'Modified', resource: 'publish articles', date: '2023-11-30' },
  { id: '#PCH-1231', user: 'Emily Davis', role: 'viewer', action: 'Added', resource: 'view articles', date: '2023-11-30' },
  { id: '#PCH-1230', user: 'David Wilson', role: 'guest', action: 'Modified', resource: 'view articles', date: '2023-11-29' },
]

const timeRange = ref('Last 30 days')
const timeRanges = ['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Last year', 'All time']

// Filter states
const permissionFilter = ref('')
const roleFilter = ref('')

// Computed filtered permissions
const filteredPermissions = computed(() => {
  return permissions.filter(permission => {
    const nameMatch = permission.name.toLowerCase().includes(permissionFilter.value.toLowerCase());
    return nameMatch;
  });
});

// Methods
const addRole = () => {
  showRoleModal.value = true;
}

const saveRole = () => {
  // Here would be the API call to save the role
  showRoleModal.value = false;
  // Reset form
  roleForm.name = '';
  roleForm.description = '';
  roleForm.permissions = [];
}

const addPermission = () => {
  showPermissionModal.value = true;
}

const savePermission = () => {
  // Here would be the API call to save the permission
  showPermissionModal.value = false;
  // Reset form
  permissionForm.name = '';
  permissionForm.description = '';
}

const editRole = (role: Role) => {
  roleForm.name = role.name;
  roleForm.description = role.description;
  roleForm.permissions = rolePermissions[role.id] || [];
  showRoleModal.value = true;
}

const deleteRole = (roleId: number) => {
  // Here would be the API call to delete the role
  // For now, just show a confirmation dialog
  if (confirm('Are you sure you want to delete this role?')) {
    console.log('Deleting role', roleId);
  }
}
</script>

<template>
  <main>
    <div class="relative isolate overflow-hidden">
      <div class="px-6 py-6 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-7xl">
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Permissions Management</h1>

          <!-- Time range selector -->
          <div class="mt-4 flex items-center justify-between">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Overview of system permissions and roles
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
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Roles</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">5</dd>
              <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
                <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
                <span>1 new role added</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Permissions</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">105</dd>
              <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
                <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
                <span>12 new permissions</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Users with Roles</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">95</dd>
              <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
                <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
                <span>8.3% increase</span>
              </dd>
            </div>

            <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
              <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Permission Changes</dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">145</dd>
              <dd class="mt-2 flex items-center text-sm text-red-600 dark:text-red-400">
                <div class="i-hugeicons-analytics-down h-4 w-4 mr-1"></div>
                <span>5.2% decrease</span>
              </dd>
            </div>
          </dl>

          <!-- Charts -->
          <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="p-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Permissions by Role</h3>
                <div class="mt-2 h-80">
                  <Pie :data="permissionsByRoleData" :options="pieChartOptions" />
                </div>
              </div>
            </div>

            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="p-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Permission Activity</h3>
                <div class="mt-2 h-80">
                  <Bar :data="permissionActivityData" :options="barChartOptions" />
                </div>
              </div>
            </div>
          </div>

          <!-- Roles Table -->
          <div class="mt-8">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Roles</h3>
                <button
                  @click="addRole"
                  class="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-blue-gray-800"
                >
                  Add Role
                </button>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Role Name</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Description</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Users</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Last Updated</th>
                      <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200 dark:bg-blue-gray-800 dark:divide-gray-700">
                    <tr v-for="role in roles" :key="role.id">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{{ role.name }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ role.description }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ role.users }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ role.lastUpdated }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button @click="editRole(role)" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3">Edit</button>
                        <button @click="deleteRole(role.id)" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Permissions Table -->
          <div class="mt-8">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Permissions</h3>
                <div class="flex items-center space-x-4">
                  <div class="flex items-center space-x-2">
                    <label for="permission-filter" class="text-sm text-gray-500 dark:text-gray-400">Filter:</label>
                    <input
                      id="permission-filter"
                      v-model="permissionFilter"
                      type="text"
                      placeholder="Search permissions..."
                      class="w-64 rounded-md border-0 py-1.5 pl-3 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
                    />
                  </div>
                  <button
                    @click="addPermission"
                    class="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-blue-gray-800"
                  >
                    Add Permission
                  </button>
                </div>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">ID</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Name</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Description</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Created</th>
                      <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200 dark:bg-blue-gray-800 dark:divide-gray-700">
                    <tr v-for="permission in filteredPermissions" :key="permission.id">
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ permission.id }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{{ permission.name }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ permission.description }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ permission.created_at }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3">Edit</button>
                        <button class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Recent Permission Changes -->
          <div class="mt-8">
            <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:px-6">
                <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Recent Permission Changes</h3>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">ID</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">User</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Role</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Action</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Resource</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Date</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200 dark:bg-blue-gray-800 dark:divide-gray-700">
                    <tr v-for="change in recentPermissionChanges" :key="change.id">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{{ change.id }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ change.user }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ change.role }}</td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                              :class="{
                                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': change.action === 'Added',
                                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300': change.action === 'Removed',
                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300': change.action === 'Modified'
                              }">
                          {{ change.action }}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ change.resource }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ change.date }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Role Modal -->
    <div v-if="showRoleModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showRoleModal = false"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                {{ roleForm.name ? 'Edit Role' : 'Add New Role' }}
              </h3>
              <div class="mt-6">
                <form @submit.prevent="saveRole" class="space-y-4">
                  <div>
                    <label for="role-name" class="block text-left text-sm font-medium text-gray-700 dark:text-gray-300">Role Name</label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="role-name"
                        v-model="roleForm.name"
                        required
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="e.g. editor"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="role-description" class="block text-left text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="role-description"
                        v-model="roleForm.description"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Role description"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="block text-left text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
                    <div class="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2 dark:border-gray-600">
                      <div v-for="permission in permissions" :key="permission.id" class="flex items-center py-1">
                        <input
                          type="checkbox"
                          :id="`permission-${permission.id}`"
                          :value="permission.id"
                          v-model="roleForm.permissions"
                          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700"
                        />
                        <label :for="`permission-${permission.id}`" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                          {{ permission.name }}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                      @click="showRoleModal = false"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Permission Modal -->
    <div v-if="showPermissionModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showPermissionModal = false"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                Add New Permission
              </h3>
              <div class="mt-6">
                <form @submit.prevent="savePermission" class="space-y-4">
                  <div>
                    <label for="permission-name" class="block text-left text-sm font-medium text-gray-700 dark:text-gray-300">Permission Name</label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="permission-name"
                        v-model="permissionForm.name"
                        required
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="e.g. edit articles"
                      />
                    </div>
                    <p class="mt-1 text-left text-xs text-gray-500 dark:text-gray-400">
                      Use verb-noun format (e.g., "edit articles", "view users")
                    </p>
                  </div>

                  <div>
                    <label for="permission-description" class="block text-left text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="permission-description"
                        v-model="permissionForm.description"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Permission description"
                      />
                    </div>
                  </div>

                  <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                      @click="showPermissionModal = false"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
