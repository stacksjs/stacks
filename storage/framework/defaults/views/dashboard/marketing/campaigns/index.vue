<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Marketing Campaigns',
})

// Define campaign type
interface Campaign {
  id: number
  uuid: string
  name: string
  type: string
  status: string
  startDate: string
  endDate: string | null
  budget: number
  spent: number
  goal: string
  goalTarget: number
  goalProgress: number
  audience: string
  channels: string[]
  owner: string
  ownerAvatar: string
  createdAt: string
  lastModified: string
  // Email campaign specific fields
  emailSubject?: string
  emailContent?: string
  emailTemplate?: string
  emailSender?: string
  emailList?: string
  email_list_uuid?: string
  from_email?: string
  from_name?: string
  html?: string
  structured_html?: string
  email_html?: string
  webview_html?: string
  mailable_class?: string
  segment_class?: string
  segment_description?: string
  // Analytics
  sent_to_number_of_subscribers?: string
  open_count?: string
  unique_open_count?: string
  open_rate?: number
  click_count?: string
  unique_click_count?: string
  click_rate?: number
  unsubscribe_count?: string
  unsubscribe_rate?: string
  bounce_count?: string
  bounce_rate?: string
  // Text message campaign specific fields
  smsContent?: string
  smsPhoneList?: string
  smsSchedule?: string
  smsCharacterCount?: number
  scheduled_at?: string | null
  // Goal tracking fields
  customGoalName?: string
  goalTrigger?: 'page_visit' | 'button_click' | 'form_submit' | 'purchase' | 'custom_event' | 'cart_abandoned' | 'model_event'
  triggerUrl?: string
  triggerSelector?: string
  triggerEvent?: string
  goalValue?: number
  // Abandoned cart specific fields
  abandonedCartTrigger?: {
    timeThreshold: number // in minutes
    timeUnit: 'minutes' | 'hours' | 'days'
    minimumCartValue: number
    excludeProducts: string[]
    requireProducts: string[]
    userSegment: string[]
    maxReminders: number
    reminderIntervals: number[] // Made required
  }
  // Model event trigger fields
  modelTrigger?: {
    model: keyof typeof modelFields
    event: 'created' | 'updated' | 'deleted' | 'restored' | 'custom'
    conditions: {
      field: string
      operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in'
      value: any
    }[]
    customEvent?: string
  }
}

// Add available models
const availableModels = [
  'AccessToken',
  'Post',
  'Subscriber',
  'Team',
  'Deployment',
  'Project',
  'Release',
  'User',
  'Product',
  'SubscriberEmail'
]

// Add model fields (this would normally come from API)
const modelFields = {
  AccessToken: ['user_id', 'name', 'abilities', 'last_used_at'],
  Post: ['title', 'content', 'status', 'published_at', 'author_id'],
  Subscriber: ['email', 'status', 'subscribed_at', 'unsubscribed_at'],
  Team: ['name', 'owner_id', 'settings'],
  Deployment: ['status', 'environment', 'version', 'deployed_at'],
  Project: ['name', 'description', 'status', 'team_id'],
  Release: ['version', 'notes', 'released_at'],
  User: ['name', 'email', 'status', 'role', 'last_login_at'],
  Product: ['name', 'price', 'status', 'inventory_count'],
  SubscriberEmail: ['subscriber_id', 'email', 'verified_at']
} as const;

// Add standard model events
const standardModelEvents = ['created', 'updated', 'deleted', 'restored', 'custom']

// Sample campaigns data
const campaigns = ref<Campaign[]>([
  {
    id: 1,
    uuid: '11ce123b-57c4-429b-9840-c79f8047d8aa',
    name: 'Summer Sale Promotion',
    type: 'Discount',
    status: 'Active',
    startDate: '2023-06-01',
    endDate: '2023-08-31',
    budget: 5000,
    spent: 3200,
    goal: 'Sales',
    goalTarget: 50000,
    goalProgress: 32000,
    audience: 'All Customers',
    channels: ['Email', 'Social Media', 'Website'],
    owner: 'Alex Johnson',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    createdAt: '2023-05-15',
    lastModified: '2023-07-10'
  },
  {
    id: 2,
    uuid: '22ce123b-57c4-429b-9840-c79f8047d8bb',
    name: 'New Product Launch',
    type: 'Product Launch',
    status: 'Scheduled',
    startDate: '2023-09-15',
    endDate: '2023-10-15',
    budget: 10000,
    spent: 0,
    goal: 'Awareness',
    goalTarget: 100000,
    goalProgress: 0,
    audience: 'Existing Customers',
    channels: ['Email', 'Social Media', 'Paid Ads', 'PR'],
    owner: 'Sarah Miller',
    ownerAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    createdAt: '2023-07-20',
    lastModified: '2023-07-25'
  },
  {
    id: 3,
    uuid: '33ce123b-57c4-429b-9840-c79f8047d8cc',
    name: 'Holiday Season Special',
    type: 'Seasonal',
    status: 'Draft',
    startDate: '2023-11-20',
    endDate: '2023-12-31',
    budget: 8000,
    spent: 0,
    goal: 'Sales',
    goalTarget: 75000,
    goalProgress: 0,
    audience: 'All Customers',
    channels: ['Email', 'Social Media', 'Website', 'Paid Ads'],
    owner: 'David Chen',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/67.jpg',
    createdAt: '2023-08-05',
    lastModified: '2023-08-05'
  },
  {
    id: 4,
    uuid: '44ce123b-57c4-429b-9840-c79f8047d8dd',
    name: 'Customer Loyalty Program',
    type: 'Loyalty',
    status: 'Active',
    startDate: '2023-01-01',
    endDate: null,
    budget: 12000,
    spent: 7500,
    goal: 'Retention',
    goalTarget: 500,
    goalProgress: 320,
    audience: 'Existing Customers',
    channels: ['Email', 'App', 'Website'],
    owner: 'Emily Wilson',
    ownerAvatar: 'https://randomuser.me/api/portraits/women/23.jpg',
    createdAt: '2022-12-10',
    lastModified: '2023-06-15'
  },
  {
    id: 5,
    uuid: '55ce123b-57c4-429b-9840-c79f8047d8ee',
    name: 'Back to School Campaign',
    type: 'Seasonal',
    status: 'Completed',
    startDate: '2022-08-01',
    endDate: '2022-09-15',
    budget: 4500,
    spent: 4500,
    goal: 'Sales',
    goalTarget: 30000,
    goalProgress: 35200,
    audience: 'Students & Parents',
    channels: ['Email', 'Social Media', 'Paid Ads'],
    owner: 'Michael Thompson',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/42.jpg',
    createdAt: '2022-07-05',
    lastModified: '2022-09-20'
  },
  {
    id: 6,
    uuid: '66ce123b-57c4-429b-9840-c79f8047d8ff',
    name: 'Spring Collection Launch',
    type: 'Product Launch',
    status: 'Completed',
    startDate: '2023-03-01',
    endDate: '2023-04-15',
    budget: 7500,
    spent: 7200,
    goal: 'Sales',
    goalTarget: 45000,
    goalProgress: 42000,
    audience: 'All Customers',
    channels: ['Email', 'Social Media', 'Website', 'PR'],
    owner: 'Jessica Lee',
    ownerAvatar: 'https://randomuser.me/api/portraits/women/56.jpg',
    createdAt: '2023-02-10',
    lastModified: '2023-04-20'
  },
  {
    id: 7,
    uuid: '77ce123b-57c4-429b-9840-c79f8047d8gg',
    name: 'App Download Promotion',
    type: 'App Promotion',
    status: 'Active',
    startDate: '2023-07-01',
    endDate: '2023-09-30',
    budget: 6000,
    spent: 2800,
    goal: 'Downloads',
    goalTarget: 10000,
    goalProgress: 6500,
    audience: 'All Customers',
    channels: ['Email', 'Social Media', 'Paid Ads', 'Website'],
    owner: 'Robert Garcia',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/78.jpg',
    createdAt: '2023-06-15',
    lastModified: '2023-07-25'
  },
  {
    id: 8,
    uuid: '88ce123b-57c4-429b-9840-c79f8047d8hh',
    name: 'Black Friday Sale',
    type: 'Discount',
    status: 'Draft',
    startDate: '2023-11-24',
    endDate: '2023-11-27',
    budget: 15000,
    spent: 0,
    goal: 'Sales',
    goalTarget: 100000,
    goalProgress: 0,
    audience: 'All Customers',
    channels: ['Email', 'Social Media', 'Paid Ads', 'Website', 'PR'],
    owner: 'Sophia Martinez',
    ownerAvatar: 'https://randomuser.me/api/portraits/women/90.jpg',
    createdAt: '2023-08-10',
    lastModified: '2023-08-10'
  },
  {
    id: 13,
    uuid: '99ce123b-57c4-429b-9840-c79f8047d8ii',
    name: 'Monthly Newsletter',
    type: 'Email',
    status: 'Scheduled',
    startDate: '2023-12-25',
    endDate: '2023-12-25',
    budget: 500,
    spent: 0,
    goal: 'Engagement',
    goalTarget: 2000,
    goalProgress: 0,
    audience: 'All Subscribers',
    channels: ['Email'],
    owner: 'Sarah Miller',
    ownerAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    createdAt: '2023-12-10',
    lastModified: '2023-12-10',
    emailSubject: 'Your December Newsletter - Special Holiday Offers Inside!',
    emailContent: '<h1>December Newsletter</h1><p>Hello valued customer,</p><p>Check out our latest products and special holiday offers!</p><p>Use code <strong>HOLIDAY20</strong> for 20% off your next purchase.</p>',
    emailTemplate: 'newsletter',
    emailSender: 'newsletter@example.com',
    emailList: 'All Subscribers'
  },
  {
    id: 14,
    uuid: 'aace123b-57c4-429b-9840-c79f8047d8jj',
    name: 'Holiday Sale Announcement',
    type: 'Email',
    status: 'Active',
    startDate: '2023-12-15',
    endDate: '2023-12-31',
    budget: 1200,
    spent: 800,
    goal: 'Sales',
    goalTarget: 50000,
    goalProgress: 32000,
    audience: 'All Customers',
    channels: ['Email'],
    owner: 'Alex Johnson',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    createdAt: '2023-12-01',
    lastModified: '2023-12-05',
    emailSubject: 'Holiday Sale - Up to 50% Off Everything!',
    emailContent: '<h1>Holiday Sale!</h1><p>Dear customer,</p><p>Our biggest sale of the year is here! Enjoy up to 50% off everything in our store.</p><p>Sale ends December 31st. Don\'t miss out!</p>',
    emailTemplate: 'promotional',
    emailSender: 'sales@example.com',
    emailList: 'All Customers'
  },
  {
    id: 15,
    uuid: 'bbce123b-57c4-429b-9840-c79f8047d8kk',
    name: 'Flash Sale Alert',
    type: 'SMS',
    status: 'Scheduled',
    startDate: '2023-12-20',
    endDate: '2023-12-20',
    budget: 300,
    spent: 0,
    goal: 'Sales',
    goalTarget: 10000,
    goalProgress: 0,
    audience: 'Opted-in Customers',
    channels: ['SMS'],
    owner: 'David Chen',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/67.jpg',
    createdAt: '2023-12-15',
    lastModified: '2023-12-15',
    smsContent: 'FLASH SALE TODAY ONLY! 30% off all items with code FLASH30. Shop now at example.com/sale',
    smsPhoneList: 'Opted-in Customers',
    smsSchedule: 'Morning',
    smsCharacterCount: 93
  },
  {
    id: 16,
    uuid: 'ccce123b-57c4-429b-9840-c79f8047d8ll',
    name: 'Order Delivery Notification',
    type: 'SMS',
    status: 'Active',
    startDate: '2023-12-01',
    endDate: null,
    budget: 200,
    spent: 120,
    goal: 'Customer Service',
    goalTarget: 500,
    goalProgress: 320,
    audience: 'Recent Customers',
    channels: ['SMS'],
    owner: 'Emily Wilson',
    ownerAvatar: 'https://randomuser.me/api/portraits/women/23.jpg',
    createdAt: '2023-11-25',
    lastModified: '2023-11-30',
    smsContent: 'Your order #[ORDER_ID] has been delivered! Thank you for shopping with us. Rate your experience: example.com/feedback/[ORDER_ID]',
    smsPhoneList: 'Recent Customers',
    smsSchedule: 'Immediate',
    smsCharacterCount: 124
  },
  {
    id: 17,
    uuid: 'ddce123b-57c4-429b-9840-c79f8047d8mm',
    name: 'Abandoned Cart Recovery',
    type: 'Email',
    status: 'Active',
    startDate: '2023-12-01',
    endDate: null, // Ongoing campaign
    budget: 1000,
    spent: 450,
    goal: 'Sales',
    goalTarget: 1000,
    goalProgress: 450,
    audience: 'Cart Abandoners',
    channels: ['Email'],
    owner: 'Sarah Miller',
    ownerAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    createdAt: '2023-11-30',
    lastModified: '2023-12-01',
    emailSubject: '🛒 Complete Your Purchase - Special Offer Inside!',
    emailTemplate: 'abandoned-cart',
    emailSender: 'sales@example.com',
    emailList: 'Cart Abandoners',
    goalTrigger: 'cart_abandoned',
    goalValue: 0, // Will be dynamically set based on cart value
    abandonedCartTrigger: {
      timeThreshold: 30,
      timeUnit: 'minutes',
      minimumCartValue: 50,
      excludeProducts: [],
      requireProducts: [],
      userSegment: ['registered'],
      maxReminders: 3,
      reminderIntervals: [30, 24 * 60, 72 * 60] // 30 mins, 24 hours, 72 hours
    }
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('startDate')
const sortOrder = ref('desc')
const statusFilter = ref('all')
const typeFilter = ref('all')
const viewMode = ref('compact') // 'detailed' or 'compact'

// Available statuses
const statuses = ['all', 'sent', 'scheduled', 'draft']

// Available types
const types = ['all', 'Email', 'SMS']

// Available sorts
const availableSorts = [
  { value: 'name', label: 'Name' },
  { value: 'unique_open_count', label: 'Opens' },
  { value: 'unique_click_count', label: 'Clicks' },
  { value: 'unsubscribe_rate', label: 'Unsubscribes' },
  { value: 'sent_to_number_of_subscribers', label: 'Sent To' },
  { value: 'sent', label: 'Send Date' }
]

// Computed filtered and sorted campaigns
const filteredCampaigns = computed(() => {
  return campaigns.value
    .filter(campaign => {
      // Apply search filter
      const matchesSearch =
        campaign.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        campaign.owner.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || campaign.status === statusFilter.value

      // Apply type filter
      const matchesType = typeFilter.value === 'all' || campaign.type === typeFilter.value

      return matchesSearch && matchesStatus && matchesType
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'startDate') {
        comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      } else if (sortBy.value === 'budget') {
        comparison = a.budget - b.budget
      } else if (sortBy.value === 'goalProgress') {
        comparison = a.goalProgress - b.goalProgress
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Pagination
const itemsPerPage = ref(9);
const currentPage = ref(1);

const totalPages = computed(() => {
  return Math.ceil(filteredCampaigns.value.length / itemsPerPage.value);
});

const paginatedCampaigns = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  const endIndex = startIndex + itemsPerPage.value;
  return filteredCampaigns.value.slice(startIndex, endIndex);
});

// Pagination functions
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const goToPage = (page: number) => {
  currentPage.value = page;
};

// Calculate displayed page numbers for pagination
const displayedPages = computed(() => {
  const totalPagesToShow = 5;
  const pages: number[] = [];

  if (totalPages.value <= totalPagesToShow) {
    // If we have fewer pages than we want to show, display all pages
    for (let i = 1; i <= totalPages.value; i++) {
      pages.push(i);
    }
  } else {
    // Always include first page
    pages.push(1);

    // Calculate start and end of page range around current page
    let startPage = Math.max(2, currentPage.value - 1);
    let endPage = Math.min(totalPages.value - 1, currentPage.value + 1);

    // Adjust if we're at the start or end
    if (currentPage.value <= 2) {
      endPage = 4;
    } else if (currentPage.value >= totalPages.value - 1) {
      startPage = totalPages.value - 3;
    }

    // Add ellipsis if needed before middle pages
    if (startPage > 2) {
      pages.push(-1); // -1 represents ellipsis
    }

    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Add ellipsis if needed after middle pages
    if (endPage < totalPages.value - 1) {
      pages.push(-2); // -2 represents ellipsis
    }

    // Always include last page
    pages.push(totalPages.value);
  }

  return pages;
});

// Toggle sort order
function toggleSort(column: string): void {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortOrder.value = 'desc'
  }
}

// Get status badge class
function getStatusClass(status: string): string {
  switch (status) {
    case 'Active':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Scheduled':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    case 'Draft':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Completed':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

// Format date
function formatDate(date: string | null): string {
  if (!date) return 'Ongoing'
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Calculate progress percentage
function calculateProgress(progress: number, target: number) {
  return Math.round((progress / target) * 100);
}

// Modal state
const showCampaignModal = ref(false)
const isEditMode = ref(false)
const currentCampaign = ref<Campaign>({
  id: 0,
  uuid: '',
  name: '',
  type: 'Email',
  status: 'Draft',
  audience: '',
  startDate: '',
  endDate: null,
  budget: 0,
  spent: 0,
  goal: '',
  goalProgress: 0,
  goalTarget: 100,
  channels: [],
  owner: '',
  ownerAvatar: '',
  createdAt: '',
  lastModified: ''
})

const openNewCampaignModal = () => {
  const today = new Date().toISOString().split('T')[0];
  if (!today) return;

  currentCampaign.value = {
    id: Math.max(...campaigns.value.map(c => c.id)) + 1,
    uuid: crypto.randomUUID(),
    name: '',
    type: 'Email',
    status: 'Draft',
    audience: '',
    startDate: today,
    endDate: null,
    budget: 0,
    spent: 0,
    goal: 'Sales',
    goalProgress: 0,
    goalTarget: 100,
    channels: ['Email'],
    owner: 'Alex Johnson',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    createdAt: today,
    lastModified: today,
    // Initialize email campaign fields
    emailSubject: '',
    emailContent: '',
    emailTemplate: 'default',
    emailSender: 'marketing@example.com',
    emailList: 'All Subscribers',
    // Initialize text message campaign fields
    smsContent: '',
    smsPhoneList: 'All Customers',
    smsSchedule: 'Immediate',
    smsCharacterCount: 0,
    // Initialize goal tracking fields
    customGoalName: '',
    goalTrigger: 'page_visit',
    triggerUrl: '',
    triggerSelector: '',
    triggerEvent: '',
    goalValue: 0,
    // Initialize abandoned cart fields
    abandonedCartTrigger: {
      timeThreshold: 30,
      timeUnit: 'minutes',
      minimumCartValue: 50,
      excludeProducts: [],
      requireProducts: [],
      userSegment: ['registered'],
      maxReminders: 3,
      reminderIntervals: [30, 1440, 4320] // 30 mins, 24 hours, 72 hours
    },
    modelTrigger: {
      model: 'User', // Default to User model
      event: 'created',
      conditions: []
    }
  };

  isEditMode.value = false;
  showCampaignModal.value = true;
};

// Add a watch to initialize abandonedCartTrigger when goalTrigger changes to 'cart_abandoned'
watch(() => currentCampaign.value.goalTrigger, (newValue) => {
  if (newValue === 'cart_abandoned' && !currentCampaign.value.abandonedCartTrigger) {
    currentCampaign.value.abandonedCartTrigger = {
      timeThreshold: 30,
      timeUnit: 'minutes',
      minimumCartValue: 50,
      excludeProducts: [],
      requireProducts: [],
      userSegment: ['registered'],
      maxReminders: 3,
      reminderIntervals: [30, 1440, 4320]
    };
  }
});

function openEditCampaignModal(campaign: Campaign): void {
  currentCampaign.value = { ...campaign }
  isEditMode.value = true
  showCampaignModal.value = true
}

function closeCampaignModal(): void {
  showCampaignModal.value = false
}

// Add scheduling state
const isScheduled = ref(false)
const scheduleDate = ref('')
const scheduleTime = ref('')

// Update save campaign to handle scheduling
const saveCampaign = () => {
  if (!currentCampaign.value) return;

  const today = new Date().toISOString().split('T')[0];
  if (!today) return;

  // Handle scheduling
  if (isScheduled.value && scheduleDate.value && scheduleTime.value) {
    const scheduledDateTime = `${scheduleDate.value} ${scheduleTime.value}:00`;
    currentCampaign.value.scheduled_at = scheduledDateTime;
  } else {
    currentCampaign.value.scheduled_at = null;
  }

  currentCampaign.value.lastModified = today;

  if (isEditMode.value) {
    const index = campaigns.value.findIndex(c => c.id === currentCampaign.value?.id);
    if (index !== -1) {
      campaigns.value[index] = { ...currentCampaign.value };
    }
  } else {
    campaigns.value.push({ ...currentCampaign.value });
  }

  showCampaignModal.value = false;
};

// Delete campaign
function deleteCampaign(campaignId: number): void {
  const index = campaigns.value.findIndex(c => c.id === campaignId)
  if (index !== -1) {
    campaigns.value.splice(index, 1)
  }
}

// Update SMS character count
const updateSmsCharacterCount = () => {
  if (currentCampaign.value && currentCampaign.value.smsContent) {
    currentCampaign.value.smsCharacterCount = currentCampaign.value.smsContent.length;
  } else if (currentCampaign.value) {
    currentCampaign.value.smsCharacterCount = 0;
  }
};

// Calculate summary statistics
const totalActiveCampaigns = computed(() => campaigns.value.filter(c => c.status === 'Active').length)
const totalScheduledCampaigns = computed(() => campaigns.value.filter(c => c.status === 'Scheduled').length)
// Define empty placeholders for totalBudget and totalSpent to avoid template errors
const totalBudget = computed(() => 0)
const totalSpent = computed(() => 0)

// Calculate campaign type metrics
const totalEmailCampaigns = computed(() => campaigns.value.filter(c => c.type === 'Email').length)
const totalSmsCampaigns = computed(() => campaigns.value.filter(c => c.type === 'SMS').length)
// Commenting out other campaign types as we're focusing only on email and SMS
// const totalSocialMediaCampaigns = computed(() => campaigns.value.filter(c => c.type === 'Social Media').length)

// Get campaign type icon
const getCampaignTypeIcon = (type: string): string => {
  switch (type) {
    case 'Email':
      return 'i-hugeicons-envelope'
    case 'SMS':
      return 'i-hugeicons-message-text'
    case 'Social Media':
      return 'i-hugeicons-share-01'
    case 'Content':
      return 'i-hugeicons-document-validation'
    case 'PPC':
      return 'i-hugeicons-cursor-click'
    case 'SEO':
      return 'i-hugeicons-search-magnifying-glass'
    default:
      return 'i-hugeicons-campaign'
  }
}

// Get campaign type color
const getCampaignTypeColor = (type: string): string => {
  switch (type) {
    case 'Email':
      return 'text-blue-600 dark:text-blue-400'
    case 'SMS':
      return 'text-green-600 dark:text-green-400'
    case 'Social Media':
      return 'text-purple-600 dark:text-purple-400'
    case 'Content':
      return 'text-yellow-600 dark:text-yellow-400'
    case 'PPC':
      return 'text-red-600 dark:text-red-400'
    case 'SEO':
      return 'text-gray-600 dark:text-gray-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

// Add new actions
const sendTestCampaign = async (campaign: Campaign) => {
  // Implementation will be handled by API integration
  console.log('Send test for campaign:', campaign.uuid)
}

const sendCampaign = async (campaign: Campaign) => {
  // Implementation will be handled by API integration
  console.log('Send campaign:', campaign.uuid)
}

// Update campaign metrics display
const getCampaignMetrics = (campaign: Campaign) => {
  return [
    {
      label: 'Sent To',
      value: campaign.sent_to_number_of_subscribers || '0',
      icon: 'i-hugeicons-user-multiple'
    },
    {
      label: 'Clicks',
      value: `${campaign.unique_click_count || '0'} (${campaign.click_rate || 0}%)`,
      icon: 'i-hugeicons-mouse-left-click-02'
    },
    {
      label: 'Unsubscribes',
      value: `${campaign.unsubscribe_count || '0'} (${campaign.unsubscribe_rate || '0'}%)`,
      icon: 'i-hugeicons-user-minus-01'
    },
    {
      label: 'Bounces',
      value: `${campaign.bounce_count || '0'} (${campaign.bounce_rate || '0'}%)`,
      icon: 'i-hugeicons-alert-circle'
    }
  ]
}

// Add computed property for safe access to abandonedCartTrigger
const cartTrigger = computed(() => {
  if (!currentCampaign.value.abandonedCartTrigger) {
    currentCampaign.value.abandonedCartTrigger = {
      timeThreshold: 30,
      timeUnit: 'minutes',
      minimumCartValue: 50,
      excludeProducts: [],
      requireProducts: [],
      userSegment: ['registered'],
      maxReminders: 3,
      reminderIntervals: [30, 1440, 4320]
    };
  }
  // Ensure reminderIntervals is always defined
  if (!currentCampaign.value.abandonedCartTrigger.reminderIntervals) {
    currentCampaign.value.abandonedCartTrigger.reminderIntervals = [30, 1440, 4320];
  }
  return currentCampaign.value.abandonedCartTrigger;
});

// Add helper methods for conditions
const addCondition = () => {
  if (!currentCampaign.value.modelTrigger) {
    currentCampaign.value.modelTrigger = {
      model: 'User',
      event: 'created',
      conditions: []
    };
  }
  const model = currentCampaign.value.modelTrigger.model;
  currentCampaign.value.modelTrigger.conditions.push({
    field: modelFields[model][0],
    operator: 'equals',
    value: ''
  });
};

const removeCondition = (index: number) => {
  currentCampaign.value.modelTrigger?.conditions.splice(index, 1);
};
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header section -->
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Campaigns</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage your marketing campaigns across different channels
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openNewCampaignModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Create campaign
            </button>
          </div>
        </div>

        <!-- Summary cards -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Active campaigns card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-green-100 p-2 dark:bg-green-900">
                    <div class="i-hugeicons-play-circle h-6 w-6 text-green-600 dark:text-green-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Active Campaigns</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalActiveCampaigns }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Scheduled campaigns card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-blue-100 p-2 dark:bg-blue-900">
                    <div class="i-hugeicons-calendar-01 h-6 w-6 text-blue-600 dark:text-blue-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Scheduled Campaigns</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalScheduledCampaigns }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Email campaigns card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-purple-100 p-2 dark:bg-purple-900">
                    <div class="i-hugeicons-at h-6 w-6 text-purple-600 dark:text-purple-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Email Campaigns</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalEmailCampaigns }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- SMS campaigns card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-orange-100 p-2 dark:bg-orange-900">
                    <div class="i-hugeicons-sent h-6 w-6 text-orange-600 dark:text-orange-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">SMS Campaigns</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalSmsCampaigns }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Filters and view options -->
        <div class="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative max-w-sm">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
              placeholder="Search campaigns..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <!-- Status filter -->
            <select
              v-model="statusFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Draft">Draft</option>
              <option value="Completed">Completed</option>
            </select>

            <!-- Type filter -->
            <select
              v-model="typeFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Types</option>
              <option value="Email">Email</option>
              <option value="SMS">Text Message (SMS)</option>
            </select>

            <!-- View mode toggle -->
            <div class="flex rounded-md shadow-sm">
              <button
                type="button"
                @click="viewMode = 'detailed'"
                :class="[
                  'relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                  viewMode === 'detailed'
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
                ]"
              >
                <div class="i-hugeicons-grid h-5 w-5"></div>
              </button>
              <button
                type="button"
                @click="viewMode = 'compact'"
                :class="[
                  'relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                  viewMode === 'compact'
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
                ]"
              >
                <div class="i-hugeicons-list-view h-5 w-5"></div>
              </button>
            </div>
          </div>
        </div>

        <!-- Sort options -->
        <div class="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
          <span class="mr-2">Sort by:</span>
          <button
            @click="toggleSort('name')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'name' }"
          >
            Name
            <span v-if="sortBy === 'name'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('startDate')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'startDate' }"
          >
            Date
            <span v-if="sortBy === 'startDate'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
          <!-- <button
            @click="toggleSort('budget')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'budget' }"
          >
            Budget
            <span v-if="sortBy === 'budget'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button> -->
          <button
            @click="toggleSort('goalProgress')"
            class="flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'goalProgress' }"
          >
            Progress
            <span v-if="sortBy === 'goalProgress'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
        </div>

        <!-- Compact view (table) -->
        <div v-if="viewMode === 'compact'" class="mt-6 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-700">
              <tr>
                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Campaign</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Type</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Dates</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Metrics</th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
              <tr v-if="paginatedCampaigns.length === 0">
                <td colspan="6" class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No campaigns found. Try adjusting your search or filter.
                </td>
              </tr>
              <tr v-for="campaign in paginatedCampaigns" :key="campaign.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div class="flex items-center">
                    <div class="ml-4">
                      <div class="font-medium text-gray-900 dark:text-white">{{ campaign.name }}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">{{ campaign.audience }}</div>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <div class="flex items-center">
                    <div :class="getCampaignTypeIcon(campaign.type) + ' h-4 w-4 mr-2 ' + getCampaignTypeColor(campaign.type)"></div>
                    {{ campaign.type }}
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span :class="[getStatusClass(campaign.status), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium w-fit']">
                    {{ campaign.status }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <div>{{ formatDate(campaign.startDate) }}</div>
                  <div class="text-xs">to {{ formatDate(campaign.endDate) }}</div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <div class="space-y-1">
                    <div v-for="metric in getCampaignMetrics(campaign)" :key="metric.label" class="flex items-center">
                      <div :class="metric.icon + ' h-4 w-4 mr-2'"></div>
                      <span class="text-xs">{{ metric.label }}: {{ metric.value }}</span>
                    </div>
                  </div>
                </td>
                <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div class="flex justify-end space-x-2">
                    <button
                      v-if="campaign.status === 'draft' || campaign.status === 'scheduled'"
                      @click="sendTestCampaign(campaign)"
                      class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-all duration-150"
                      title="Send Test"
                    >
                      <div class="i-hugeicons-paper-plane h-5 w-5"></div>
                      <span class="sr-only">Send Test</span>
                    </button>
                    <button
                      v-if="campaign.status === 'draft'"
                      @click="sendCampaign(campaign)"
                      class="text-gray-400 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 transition-all duration-150"
                      title="Send Campaign"
                    >
                      <div class="i-hugeicons-send h-5 w-5"></div>
                      <span class="sr-only">Send Campaign</span>
                    </button>
                    <button
                      @click="openEditCampaignModal(campaign)"
                      class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-all duration-150"
                      title="Edit"
                    >
                      <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                      <span class="sr-only">Edit</span>
                    </button>
                    <button
                      @click="deleteCampaign(campaign.id)"
                      class="text-gray-400 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-all duration-150"
                      title="Delete"
                    >
                      <div class="i-hugeicons-waste h-5 w-5"></div>
                      <span class="sr-only">Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Detailed view (cards) -->
        <div v-if="viewMode === 'detailed'" class="mt-6">
          <div v-if="paginatedCampaigns.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
            <div class="i-hugeicons-search-magnifying-glass h-12 w-12 text-gray-400 dark:text-gray-600"></div>
            <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No campaigns found</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or filters.</p>
          </div>

          <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="campaign in paginatedCampaigns" :key="campaign.id" class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
              <div class="px-4 py-5 sm:p-6">
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">{{ campaign.name }}</h3>
                  <span :class="[getStatusClass(campaign.status), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium w-fit']">
                    {{ campaign.status }}
                  </span>
                </div>
                <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ campaign.type }}</div>
                <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ campaign.audience }}</div>

                <div class="mt-4">
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">Start date:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ formatDate(campaign.startDate) }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">End date:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ formatDate(campaign.endDate) }}</span>
                  </div>
                </div>

                <!-- Campaign Metrics -->
                <div class="mt-4 grid grid-cols-2 gap-4">
                  <div v-for="metric in getCampaignMetrics(campaign)" :key="metric.label" class="col-span-1">
                    <div class="flex items-center">
                      <div :class="metric.icon + ' h-5 w-5 mr-2 text-gray-400 dark:text-gray-500'"></div>
                      <div>
                        <div class="text-sm font-medium text-gray-900 dark:text-white">{{ metric.value }}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">{{ metric.label }}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Email campaign details -->
                <div v-if="campaign.type === 'Email'" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Email Details</h4>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">Subject:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ campaign.emailSubject }}</span>
                  </div>
                  <div class="flex justify-between text-sm mt-1">
                    <span class="text-gray-500 dark:text-gray-400">Sender:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ campaign.emailSender }}</span>
                  </div>
                  <div class="flex justify-between text-sm mt-1">
                    <span class="text-gray-500 dark:text-gray-400">Recipients:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ campaign.emailList }}</span>
                  </div>
                  <div class="flex justify-between text-sm mt-1">
                    <span class="text-gray-500 dark:text-gray-400">Template:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ campaign.emailTemplate }}</span>
                  </div>
                </div>

                <!-- SMS campaign details -->
                <div v-if="campaign.type === 'SMS'" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Text Message Campaign Details</h4>

                  <div class="text-sm">
                    <span class="text-gray-500 dark:text-gray-400">Message:</span>
                    <p class="mt-1 font-medium text-gray-900 dark:text-white">{{ campaign.smsContent }}</p>
                  </div>
                  <div class="flex justify-between text-sm mt-2">
                    <span class="text-gray-500 dark:text-gray-400">Recipients:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ campaign.smsPhoneList }}</span>
                  </div>
                  <div class="flex justify-between text-sm mt-1">
                    <span class="text-gray-500 dark:text-gray-400">Schedule:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ campaign.smsSchedule }}</span>
                  </div>
                  <div class="flex justify-between text-sm mt-1">
                    <span class="text-gray-500 dark:text-gray-400">Characters:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ campaign.smsCharacterCount }}/160</span>
                  </div>
                </div>

                <div class="mt-4">
                  <div class="mb-1 flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">{{ campaign.goal }}:</span>
                    <span class="font-medium text-gray-900 dark:text-white">
                      {{ campaign.goalProgress }} / {{ campaign.goalTarget }}
                    </span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div
                      class="bg-blue-600 h-2.5 rounded-full dark:bg-blue-500"
                      :style="{ width: `${calculateProgress(campaign.goalProgress, campaign.goalTarget)}%` }"
                    ></div>
                  </div>
                </div>

                <!-- Campaign Actions -->
                <div class="mt-5 flex justify-end space-x-3">
                  <button
                    v-if="campaign.status === 'draft' || campaign.status === 'scheduled'"
                    @click="sendTestCampaign(campaign)"
                    class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
                  >
                    <div class="i-hugeicons-paper-plane -ml-0.5 mr-2 h-4 w-4"></div>
                    Test
                  </button>
                  <button
                    v-if="campaign.status === 'draft'"
                    @click="sendCampaign(campaign)"
                    class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
                  >
                    <div class="i-hugeicons-send -ml-0.5 mr-2 h-4 w-4"></div>
                    Send
                  </button>
                  <button
                    @click="openEditCampaignModal(campaign)"
                    class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
                  >
                    <div class="i-hugeicons-edit-01 -ml-0.5 mr-2 h-4 w-4"></div>
                    Edit
                  </button>
                  <button
                    @click="deleteCampaign(campaign.id)"
                    class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
                  >
                    <div class="i-hugeicons-waste -ml-0.5 mr-2 h-4 w-4"></div>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="mt-6 flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-blue-gray-800 sm:px-6">
          <div class="flex flex-1 justify-between sm:hidden">
            <button
              @click="prevPage"
              :disabled="currentPage === 1"
              class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
              :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 }"
            >
              Previous
            </button>
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
              :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages }"
            >
              Next
            </button>
          </div>
          <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700 dark:text-gray-300">
                Showing
                <span class="font-medium">{{ (currentPage - 1) * itemsPerPage + 1 }}</span>
                to
                <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredCampaigns.length) }}</span>
                of
                <span class="font-medium">{{ filteredCampaigns.length }}</span>
                results
              </p>
            </div>
            <div>
              <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  @click="prevPage"
                  :disabled="currentPage === 1"
                  class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-gray-500 dark:ring-gray-600 dark:hover:bg-blue-gray-700"
                  :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 }"
                >
                  <span class="sr-only">Previous</span>
                  <div class="i-hugeicons-arrow-left-01 h-5 w-5"></div>
                </button>
                <button
                  v-for="page in displayedPages"
                  :key="page"
                  @click="goToPage(page)"
                  :class="[
                    page === currentPage
                      ? 'relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-700'
                      : 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-700',
                  ]"
                >
                  {{ page }}
                </button>
                <button
                  @click="nextPage"
                  :disabled="currentPage === totalPages"
                  class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-gray-500 dark:ring-gray-600 dark:hover:bg-blue-gray-700"
                  :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages }"
                >
                  <span class="sr-only">Next</span>
                  <div class="i-hugeicons-arrow-right-01 h-5 w-5"></div>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Campaign Modal -->
    <div v-if="showCampaignModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity" aria-hidden="true">
          <div class="absolute inset-0 bg-gray-500 opacity-75 dark:bg-gray-900"></div>
        </div>

        <span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
        <div class="inline-block transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-blue-gray-800 sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
          <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              @click="showCampaignModal = false"
              type="button"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-cancel-01 h-6 w-6"></div>
            </button>
          </div>

          <div class="sm:flex sm:items-start">
            <div class="mt-3 w-full text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 class="text-xl font-medium leading-6 text-gray-900 dark:text-white">
                {{ isEditMode ? 'Edit Campaign' : 'Create New Campaign' }}
              </h3>
              <div class="mt-6">
                <form @submit.prevent="saveCampaign">
                  <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div class="sm:col-span-6">
                      <label for="campaign-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Campaign Name
                      </label>
                      <div class="mt-1">
                        <input
                          id="campaign-name"
                          v-model="currentCampaign.name"
                          type="text"
                          placeholder="e.g. Summer Sale 2024"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div class="sm:col-span-3">
                      <label for="campaign-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Type
                      </label>
                      <div class="mt-1">
                        <select
                          id="campaign-type"
                          v-model="currentCampaign.type"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                          required
                        >
                          <option value="Email">Email</option>
                          <option value="SMS">Text Message (SMS)</option>
                        </select>
                      </div>
                    </div>

                    <div class="sm:col-span-3">
                      <label for="campaign-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Status
                      </label>
                      <div class="mt-1">
                        <select
                          id="campaign-status"
                          v-model="currentCampaign.status"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                          required
                        >
                          <option value="Draft">Draft</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="Active">Active</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                    </div>

                    <div class="sm:col-span-6">
                      <label for="campaign-audience" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Target Audience
                      </label>
                      <div class="mt-1">
                        <input
                          id="campaign-audience"
                          v-model="currentCampaign.audience"
                          type="text"
                          placeholder="e.g. All Customers, Premium Members, New Users"
                          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                        />
                      </div>
                    </div>

                    <!-- Goal Definition Section -->
                    <div class="sm:col-span-6 pt-8">
                      <div class="border-b border-gray-200 pb-4 dark:border-gray-700">
                        <h3 class="text-base font-semibold text-gray-900 dark:text-white">Goal Definition</h3>
                        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Define what constitutes a successful conversion for this campaign.</p>
                      </div>

                      <div class="mt-4 space-y-4">
                        <div>
                          <label for="goal-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Goal Type
                          </label>
                          <select
                            id="goal-type"
                            v-model="currentCampaign.goal"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                            required
                          >
                            <option value="Sales">Sales</option>
                            <option value="Clicks">Link Clicks</option>
                            <option value="Opens">Email Opens</option>
                            <option value="Signups">Sign Ups</option>
                            <option value="Downloads">Downloads</option>
                            <option value="Custom">Custom Goal</option>
                          </select>
                        </div>

                        <div v-if="currentCampaign.goal === 'Custom'" class="space-y-4">
                          <div>
                            <label for="custom-goal-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Custom Goal Name
                            </label>
                            <input
                              id="custom-goal-name"
                              v-model="currentCampaign.customGoalName"
                              type="text"
                              placeholder="e.g. Product Demo Requests"
                              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                            />
                          </div>
                        </div>

                        <div class="space-y-4">
                          <div>
                            <label for="goal-trigger" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Trigger
                            </label>
                            <select
                              id="goal-trigger"
                              v-model="currentCampaign.goalTrigger"
                              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                            >
                              <option value="page_visit">Page Visit</option>
                              <option value="button_click">Button Click</option>
                              <option value="form_submit">Form Submission</option>
                              <option value="purchase">Purchase Completion</option>
                              <option value="custom_event">Custom Event</option>
                              <option value="cart_abandoned">Cart Abandoned</option>
                              <option value="model_event">Model Event</option>
                            </select>
                          </div>

                          <div v-if="currentCampaign.goalTrigger === 'page_visit'">
                            <label for="trigger-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Target URL
                            </label>
                            <input
                              id="trigger-url"
                              v-model="currentCampaign.triggerUrl"
                              type="text"
                              placeholder="e.g. /thank-you or https://example.com/success"
                              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                            />
                          </div>

                          <div v-if="currentCampaign.goalTrigger === 'button_click'">
                            <label for="trigger-selector" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Button Selector
                            </label>
                            <input
                              id="trigger-selector"
                              v-model="currentCampaign.triggerSelector"
                              type="text"
                              placeholder="e.g. #submit-button or .buy-now"
                              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                            />
                          </div>

                          <div v-if="currentCampaign.goalTrigger === 'custom_event'">
                            <label for="trigger-event" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Event Name
                            </label>
                            <input
                              id="trigger-event"
                              v-model="currentCampaign.triggerEvent"
                              type="text"
                              placeholder="e.g. productView, checkoutComplete"
                              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                            />
                          </div>

                          <!-- Model Event Configuration -->
                          <div v-if="currentCampaign.goalTrigger === 'model_event'" class="space-y-6 border-t border-gray-200 pt-4 dark:border-gray-700">
                            <h4 class="text-sm font-medium text-gray-900 dark:text-white">Model Event Settings</h4>

                            <!-- Initialize modelTrigger if not exists -->
                            <div v-if="!currentCampaign.modelTrigger">
                              <button
                                type="button"
                                @click="addCondition"
                                class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
                              >
                                <div class="i-hugeicons-plus-circle h-4 w-4 mr-2"></div>
                                Initialize Model Event
                              </button>
                            </div>

                            <template v-else>
                              <!-- Model Selection -->
                              <div>
                                <label for="model-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Select Model
                                </label>
                                <select
                                  id="model-select"
                                  v-model="currentCampaign.modelTrigger.model"
                                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                                >
                                  <option v-for="model in availableModels" :key="model" :value="model">{{ model }}</option>
                                </select>
                              </div>

                               <!-- Event Type -->
                              <div>
                                <label for="event-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Event Type
                                </label>
                                <select
                                  id="event-type"
                                  v-model="currentCampaign.modelTrigger.event"
                                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                                >
                                  <option v-for="event in standardModelEvents" :key="event" :value="event">
                                    {{ event.charAt(0).toUpperCase() + event.slice(1) }}
                                  </option>
                                </select>
                              </div>

                              <!-- Custom Event Name (if custom selected) -->
                              <div v-if="currentCampaign.modelTrigger.event === 'custom'">
                                <label for="custom-event-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Custom Event Name
                                </label>
                                <input
                                  id="custom-event-name"
                                  v-model="currentCampaign.modelTrigger.customEvent"
                                  type="text"
                                  placeholder="e.g. subscription_renewed"
                                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                                />
                              </div>

                              <!-- Conditions -->
                              <div>
                                <div class="flex items-center justify-between">
                                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Conditions
                                  </label>
                                  <button
                                    type="button"
                                    @click="addCondition"
                                    class="inline-flex items-center rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
                                  >
                                    <div class="i-hugeicons-plus-sign-circle h-4 w-4 mr-2"></div>
                                    Add Condition
                                  </button>
                                </div>

                                <div v-for="(condition, index) in currentCampaign.modelTrigger.conditions" :key="index" class="mt-3 grid grid-cols-12 gap-2">
                                  <!-- Field -->
                                  <div class="col-span-4">
                                    <select
                                      v-model="condition.field"
                                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                                    >
                                      <option v-for="field in modelFields[currentCampaign.modelTrigger.model]" :key="field" :value="field">
                                        {{ field }}
                                      </option>
                                    </select>
                                  </div>

                                  <!-- Operator -->
                                  <div class="col-span-3">
                                    <select
                                      v-model="condition.operator"
                                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                                    >
                                      <option value="equals">Equals</option>
                                      <option value="not_equals">Not Equals</option>
                                      <option value="contains">Contains</option>
                                      <option value="not_contains">Not Contains</option>
                                      <option value="greater_than">Greater Than</option>
                                      <option value="less_than">Less Than</option>
                                      <option value="between">Between</option>
                                      <option value="in">In List</option>
                                      <option value="not_in">Not In List</option>
                                    </select>
                                  </div>

                                  <!-- Value -->
                                  <div class="col-span-4">
                                    <input
                                      v-model="condition.value"
                                      type="text"
                                      placeholder="Value"
                                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                                    />
                                  </div>

                                  <!-- Remove Button -->
                                  <div class="col-span-1">
                                    <button
                                      type="button"
                                      @click="removeCondition(index)"
                                      class="inline-flex items-center rounded-md border border-gray-300 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600"
                                    >
                                      <div class="i-hugeicons-cancel-01 h-4 w-4"></div>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </template>
                          </div>

                          <!-- Email List Selection -->
                          <div v-if="currentCampaign.type === 'Email'" class="sm:col-span-6 pt-8">
                            <div class="border-b border-gray-200 pb-4 dark:border-gray-700">
                              <h3 class="text-base font-semibold text-gray-900 dark:text-white">Email Campaign Settings</h3>
                              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Configure your email campaign details.</p>
                            </div>

                            <div class="mt-4 space-y-4">
                              <div>
                                <label for="email-list" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Email List
                                </label>
                                <select
                                  id="email-list"
                                  v-model="currentCampaign.emailList"
                                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                                  required
                                >
                                  <option value="All Subscribers">All Subscribers</option>
                                  <option value="Newsletter">Newsletter</option>
                                  <option value="Product Updates">Product Updates</option>
                                  <option value="Marketing">Marketing</option>
                                  <option value="Cart Abandoners">Cart Abandoners</option>
                                </select>
                              </div>

                              <div>
                                <label for="email-subject" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Email Subject
                                </label>
                                <input
                                  id="email-subject"
                                  v-model="currentCampaign.emailSubject"
                                  type="text"
                                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                                  placeholder="Enter email subject"
                                  required
                                />
                              </div>

                              <div>
                                <label for="email-sender" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Sender Email
                                </label>
                                <input
                                  id="email-sender"
                                  v-model="currentCampaign.emailSender"
                                  type="email"
                                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                                  placeholder="noreply@example.com"
                                  required
                                />
                              </div>

                              <div>
                                <label for="email-template" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Email Template
                                </label>
                                <select
                                  id="email-template"
                                  v-model="currentCampaign.emailTemplate"
                                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                                  required
                                >
                                  <option value="default">Default Template</option>
                                  <option value="newsletter">Newsletter Template</option>
                                  <option value="promotional">Promotional Template</option>
                                  <option value="abandoned-cart">Abandoned Cart Template</option>
                                </select>
                              </div>

                              <div>
                                <label for="email-content" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Email Content
                                </label>
                                <textarea
                                  id="email-content"
                                  v-model="currentCampaign.emailContent"
                                  rows="6"
                                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white sm:text-sm"
                                  placeholder="Enter your email content here..."
                                  required
                                ></textarea>
                              </div>
                            </div>
                          </div>

                          <!-- Text Message Campaign Fields -->
                          <div v-if="currentCampaign.type === 'SMS'" class="sm:col-span-6">
                            <!-- ... rest of the existing template ... -->
                          </div>

                          <!-- Goal Tracking Fields -->
                          <div class="sm:col-span-6">
                            <!-- ... rest of the existing template ... -->
                          </div>

                          <!-- Abandoned Cart Fields -->
                          <div class="sm:col-span-6">
                            <!-- ... rest of the existing template ... -->
                          </div>

                           <!-- Model Event Configuration -->
                          <div class="sm:col-span-6">
                            <!-- ... rest of the existing template ... -->
                          </div>

                          <!-- Submit Button -->
                          <div class="mt-12 sm:mt-12 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                            <button
                              type="submit"
                              class="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-700 dark:hover:bg-blue-600 sm:col-start-2 sm:text-sm"
                            >
                              {{ isEditMode ? 'Save Changes' : 'Create Campaign' }}
                            </button>
                            <button
                              type="button"
                              @click="showCampaignModal = false"
                              class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-blue-gray-700 dark:text-gray-200 dark:hover:bg-blue-gray-600 sm:col-start-1 sm:mt-0 sm:text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
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
