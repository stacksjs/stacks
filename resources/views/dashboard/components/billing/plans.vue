<script setup lang="ts">
import { useBillable } from '../../../../functions/billing/payments'

const checkedPlanType = ref('monthly')
const selectedPlan = ref('')
const paymentStore = usePaymentStore()
const planTypeKey = ref('stacks_hobby_early_monthly')

const { subscribeToPlan } = useBillable()

const loading = ref(true)

const perText = computed(() => {
  if (checkedPlanType.value === 'monthly')
    return '/month'

  if (checkedPlanType.value === 'annually')
    return '/year'

  return '/lifetime'
})

const hobbyPrice = computed(() => {
  if (checkedPlanType.value === 'monthly')
    return 39

  if (checkedPlanType.value === 'annually')
    return 379

  return 479
})

const proPrice = computed(() => {
  if (checkedPlanType.value === 'monthly')
    return 59

  if (checkedPlanType.value === 'annually')
    return 579

  return 749
})

async function subscribePlan() {
  const subscriptionIntent = await subscribeToPlan({
    type: planTypeKey.value,
    plan: selectedPlan.value,
  })

  // TODO: fire a toast or something
  if (subscriptionIntent)
    alert('success!')
}
</script>

<template>
  <div class="mt-16 w-2/3 bg-white px-8 py-6 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <h2 class="text-lg text-gray-900 font-medium">
          Dashboard Plans
        </h2>
      </div>

      <div>
        <div class="flex justify-center">
          <fieldset aria-label="Payment frequency">
            <div class="grid grid-cols-3 gap-x-1 rounded-full p-1 text-center text-xs/5 font-semibold ring-1 ring-gray-200 ring-inset">
              <!-- Checked: "bg-blue-600 text-white", Not Checked: "text-gray-500" -->
              <label class="cursor-pointer rounded-full px-2.5 py-1" :class="{ 'bg-blue-600 text-white': checkedPlanType === 'monthly' }">
                <input v-model="checkedPlanType" type="radio" name="frequency" value="monthly" class="sr-only">
                <span>Monthly</span>
              </label>

              <label class="cursor-pointer rounded-full px-2.5 py-1" :class="{ 'bg-blue-600 text-white': checkedPlanType === 'annually' }">
                <input v-model="checkedPlanType" type="radio" name="frequency" value="annually" class="sr-only">
                <span>Annually</span>
              </label>

              <label class="cursor-pointer rounded-full px-2.5 py-1" :class="{ 'bg-blue-600 text-white': checkedPlanType === 'lifetime' }">
                <input v-model="checkedPlanType" type="radio" name="frequency" value="lifetime" class="sr-only">
                <span>Lifetime</span>
              </label>
            </div>
          </fieldset>
        </div>
      </div>
    </div>

    <div class="pt-8">
      <p class="text-gray-800 font-semibold">
        Choose one of the recurring plans.
      </p>
    </div>

    <div v-if="loading">
      <div class="pt-8">
        <fieldset aria-label="Server size">
          <div class="space-y-4">
            <label aria-label="hobby" class="relative block cursor-pointer border rounded-lg bg-white px-6 py-4 shadow-sm sm:flex sm:justify-between focus:outline-none">
              <input v-model="selectedPlan" type="radio" value="hobby" class="sr-only">
              <span class="flex items-center">
                <span class="flex flex-col text-sm">
                  <span class="text-gray-900 font-medium">Hobby</span>

                  <p class="pt-2 text-xs text-gray-600">
                    All Stacks features are included.
                  </p>
                </span>
              </span>
              <span class="mt-2 flex text-sm sm:ml-4 sm:mt-0 sm:flex-col sm:text-right">
                <span class="text-gray-900 font-medium">$ {{ hobbyPrice }} </span>
                <span class="ml-1 text-gray-500 sm:ml-0">{{ perText }}</span>
              </span>
              <span class="pointer-events-none absolute rounded-lg -inset-px" aria-hidden="true" :class="{ 'border-indigo-600 border-2': selectedPlan === 'hobby', 'border ': selectedPlan !== 'hobby' }" />
            </label>
            <!-- Active: "border-indigo-600 ring-2 ring-indigo-600", Not Active: "border-gray-300" -->
            <label aria-label="pro" class="relative block cursor-pointer border rounded-lg bg-white px-6 py-4 shadow-sm sm:flex sm:justify-between focus:outline-none">
              <input v-model="selectedPlan" type="radio" value="pro" class="sr-only">
              <span class="flex items-center">
                <span class="flex flex-col text-sm">
                  <span class="text-gray-900 font-medium">Pro</span>

                  <p class="pt-2 text-xs text-gray-600">
                    All Stacks features are included & being able to invite team members.
                  </p>
                </span>
              </span>
              <span class="mt-2 flex text-sm sm:ml-4 sm:mt-0 sm:flex-col sm:text-right">
                <span class="text-gray-900 font-medium">${{ proPrice }}</span>
                <span class="ml-1 text-gray-500 sm:ml-0">{{ perText }}</span>
              </span>
              <span class="pointer-events-none absolute rounded-lg -inset-px" aria-hidden="true" :class="{ 'border-indigo-600 border-2': selectedPlan === 'pro', 'border': selectedPlan !== 'pro' }" />
            </label>
          </div>
        </fieldset>
      </div>

      <div class="flex justify-end pt-8">
        <button
          type="button"
          :disabled="!paymentStore.hasPaymentMethods"
          class="rounded-md bg-blue-600 px-2.5 py-1.5 text-sm text-white font-semibold shadow-sm disabled:bg-gray-600 hover:bg-blue-gray-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
          @click="subscribePlan()"
        >
          Subscribe
        </button>
      </div>
    </div>
  </div>
</template>

<style>
#payment-message {
  color: rgb(105, 115, 134);
  font-size: 16px;
  line-height: 20px;
  padding-top: 12px;
  text-align: center;
}

#payment-element {
  margin-bottom: 24px;
}

#payment-form {
  width: 30vw;
  min-width: 500px;
  align-self: center;
  border-radius: 7px;
  padding: 40px;
}
</style>
