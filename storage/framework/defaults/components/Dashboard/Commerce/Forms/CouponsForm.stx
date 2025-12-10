<script lang="ts" setup>
import type { Coupons, NewCoupon } from '../../../../types/defaults'

interface Props {
  show: boolean
  mode: 'add' | 'edit'
  coupon?: Coupons
}

interface Emits {
  (e: 'close'): void
  (e: 'submit', coupon: NewCoupon): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Form data
const formData = ref<NewCoupon>({
  code: '',
  discount_type: 'Percentage',
  discount_value: 10,
  min_order_amount: 0,
  usage_limit: 100,
  usage_count: 0,
  start_date: '',
  end_date: '',
  status: 'Active'
})

// Default dates
const today = new Date().toISOString().split('T')[0] as string
const nextMonth = new Date()
nextMonth.setMonth(nextMonth.getMonth() + 1)
const nextMonthDate = nextMonth.toISOString().split('T')[0] as string

// Format date to yyyy-MM-dd
function formatDate(date: string | Date): string {
  if (!date) return ''
  const d = new Date(date)
  const parts = d.toISOString().split('T')
  return parts[0] || ''
}

// Watch for changes in props to populate form
watch(() => props.show, (newShow) => {
  if (newShow) {
    if (props.mode === 'edit' && props.coupon) {
      // Edit mode: populate with existing coupon data
      formData.value = { 
        ...props.coupon,
        start_date: formatDate(props.coupon.start_date),
        end_date: formatDate(props.coupon.end_date)
      }
    } else {
      // Add mode: set default values
      formData.value = {
        code: '',
        discount_type: 'Percentage',
        discount_value: 10,
        min_order_amount: 0,
        usage_limit: 100,
        usage_count: 0,
        start_date: today,
        end_date: nextMonthDate,
        status: 'Active'
      }
    }
  }
}, { immediate: true })

// Handle form submission
function handleSubmit(): void {
  emit('submit', formData.value)
}

// Handle modal close
function handleClose(): void {
  emit('close')
}

// Get modal title
const modalTitle = computed(() => {
  return props.mode === 'add' ? 'Add New Coupon' : 'Edit Coupon'
})

// Get submit button text
const submitButtonText = computed(() => {
  return props.mode === 'add' ? 'Add' : 'Update'
})
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-10 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="handleClose"></div>

      <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
        <div>
          <div class="mt-3 text-center sm:mt-5">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">{{ modalTitle }}</h3>
            <div class="mt-4">
              <div class="space-y-4">
                <div>
                  <label for="coupon-code" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Coupon Code</label>
                  <div class="mt-2">
                    <input
                      type="text"
                      id="coupon-code"
                      v-model="formData.code"
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      placeholder="e.g. SUMMER20"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label for="coupon-type" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Type</label>
                    <div class="mt-2">
                      <select
                        id="coupon-type"
                        v-model="formData.discount_type"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="Percentage">Percentage</option>
                        <option value="Fixed">Fixed Amount</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label for="coupon-value" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Value</label>
                    <div class="mt-2">
                      <div class="relative rounded-md shadow-sm">
                        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span class="text-gray-500 sm:text-sm">{{ formData.discount_type === 'Percentage' ? '%' : '$' }}</span>
                        </div>
                        <input
                          type="number"
                          id="coupon-value"
                          v-model="formData.discount_value"
                          class="block w-full rounded-md border-0 py-1.5 pl-7 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label for="min-order-amount" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Min Order Amount</label>
                    <div class="mt-2">
                      <div class="relative rounded-md shadow-sm">
                        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span class="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          id="min-order-amount"
                          v-model="formData.min_order_amount"
                          class="block w-full rounded-md border-0 py-1.5 pl-7 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="usage-limit" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Usage Limit</label>
                    <div class="mt-2">
                      <input
                        type="number"
                        id="usage-limit"
                        v-model="formData.usage_limit"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      />
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label for="start-date" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Start Date</label>
                    <div class="mt-2">
                      <input
                        type="date"
                        id="start-date"
                        v-model="formData.start_date"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="end-date" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">End Date</label>
                    <div class="mt-2">
                      <input
                        type="date"
                        id="end-date"
                        v-model="formData.end_date"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label for="coupon-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                  <div class="mt-2">
                    <select
                      id="coupon-status"
                      v-model="formData.status"
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                    >
                      <option value="Active">Active</option>
                      <option value="Scheduled">Scheduled</option>
                      <option v-if="mode === 'edit'" value="Expired">Expired</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            @click="handleSubmit"
            class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
          >
            {{ submitButtonText }}
          </button>
          <button
            type="button"
            @click="handleClose"
            class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
