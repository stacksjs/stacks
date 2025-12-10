<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import * as d3 from 'd3'

useHead({
  title: 'Dashboard - Customer Reviews',
})

// Define review type
interface Review {
  id: number
  uuid: string
  source: 'Google' | 'Yelp' | 'Facebook' | 'TripAdvisor' | 'Other'
  rating: number
  title: string
  content: string
  author: string
  authorAvatar?: string
  date: string
  location: string
  response?: {
    content: string
    date: string
    author: string
  }
  status: 'unread' | 'read' | 'responded' | 'flagged'
  sentiment: 'positive' | 'neutral' | 'negative'
  tags: string[]
  helpful: number
  notHelpful: number
  isVerified: boolean
  isHighlighted: boolean
  isHidden: boolean
  metadata?: {
    platform?: string
    deviceType?: string
    browser?: string
    ipAddress?: string
    location?: {
      country?: string
      city?: string
      state?: string
    }
  }
}

// Sample reviews data
const reviews = ref<Review[]>([
  {
    id: 1,
    uuid: '11ce123b-57c4-429b-9840-c79f8047d8aa',
    source: 'Google',
    rating: 5,
    title: 'Excellent service and product quality',
    content: 'I was extremely impressed with both the quality of the product and the customer service. The staff went above and beyond to ensure I had a great experience. Will definitely be returning!',
    author: 'Alex Johnson',
    authorAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    date: '2023-07-15',
    location: 'Main Street Branch',
    response: {
      content: "Thank you for your kind words, Alex! We're thrilled to hear you had such a positive experience with us. We look forward to serving you again soon!",
      date: '2023-07-16',
      author: 'Customer Support Team'
    },
    status: 'responded',
    sentiment: 'positive',
    tags: ['service', 'product quality', 'staff'],
    helpful: 12,
    notHelpful: 0,
    isVerified: true,
    isHighlighted: true,
    isHidden: false
  },
  {
    id: 2,
    uuid: '22ce123b-57c4-429b-9840-c79f8047d8bb',
    source: 'Yelp',
    rating: 2,
    title: 'Disappointed with wait times',
    content: 'While the product itself was decent, I had to wait over 45 minutes to be served. The staff seemed disorganized and understaffed. Might give it another try during a less busy time.',
    author: 'Sarah Miller',
    authorAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    date: '2023-07-10',
    location: 'Downtown Location',
    status: 'read',
    sentiment: 'negative',
    tags: ['wait time', 'staff', 'busy'],
    helpful: 8,
    notHelpful: 2,
    isVerified: true,
    isHighlighted: false,
    isHidden: false
  },
  {
    id: 3,
    uuid: '33ce123b-57c4-429b-9840-c79f8047d8cc',
    source: 'Google',
    rating: 4,
    title: 'Great product, room for improvement',
    content: 'The product exceeded my expectations in terms of quality. However, I think the pricing could be more competitive. Overall a good experience and I would recommend to others with that caveat.',
    author: 'David Chen',
    authorAvatar: 'https://randomuser.me/api/portraits/men/67.jpg',
    date: '2023-07-05',
    location: 'Online Store',
    response: {
      content: "Thank you for your feedback, David! We appreciate your comments about our product quality. Regarding pricing, we're constantly evaluating our offerings to provide the best value. Your feedback helps us improve!",
      date: '2023-07-06',
      author: 'Product Team'
    },
    status: 'responded',
    sentiment: 'positive',
    tags: ['product quality', 'pricing', 'value'],
    helpful: 15,
    notHelpful: 3,
    isVerified: true,
    isHighlighted: false,
    isHidden: false
  },
  {
    id: 4,
    uuid: '44ce123b-57c4-429b-9840-c79f8047d8dd',
    source: 'Yelp',
    rating: 1,
    title: 'Terrible experience, avoid at all costs',
    content: 'I had the worst experience ever. The product was defective, and when I tried to get help, the customer service was rude and unhelpful. I will never shop here again and would advise others to stay away.',
    author: 'Emily Wilson',
    authorAvatar: 'https://randomuser.me/api/portraits/women/23.jpg',
    date: '2023-07-01',
    location: 'Westside Branch',
    status: 'flagged',
    sentiment: 'negative',
    tags: ['defective product', 'customer service', 'rude staff'],
    helpful: 20,
    notHelpful: 1,
    isVerified: true,
    isHighlighted: false,
    isHidden: false
  },
  {
    id: 5,
    uuid: '55ce123b-57c4-429b-9840-c79f8047d8ee',
    source: 'Google',
    rating: 5,
    title: 'Outstanding experience from start to finish',
    content: 'I cannot say enough good things about my experience. From the moment I walked in, I was treated like a valued customer. The product is amazing and exactly what I needed. The follow-up service was also exceptional.',
    author: 'Michael Thompson',
    authorAvatar: 'https://randomuser.me/api/portraits/men/42.jpg',
    date: '2023-06-28',
    location: 'Main Street Branch',
    response: {
      content: "Thank you for your wonderful review, Michael! We're delighted to hear about your positive experience with us. Our team works hard to provide exceptional service, and we're glad it showed during your visit.",
      date: '2023-06-29',
      author: 'Customer Support Team'
    },
    status: 'responded',
    sentiment: 'positive',
    tags: ['service', 'product quality', 'follow-up'],
    helpful: 18,
    notHelpful: 0,
    isVerified: true,
    isHighlighted: true,
    isHidden: false
  },
  {
    id: 6,
    uuid: '66ce123b-57c4-429b-9840-c79f8047d8ff',
    source: 'Yelp',
    rating: 3,
    title: 'Average experience, nothing special',
    content: 'The product was okay, and the service was adequate. Nothing particularly stood out as exceptional or terrible. It met my basic needs, but I probably won\'t go out of my way to return.',
    author: 'Jessica Lee',
    authorAvatar: 'https://randomuser.me/api/portraits/women/56.jpg',
    date: '2023-06-25',
    location: 'Eastside Location',
    status: 'read',
    sentiment: 'neutral',
    tags: ['average', 'basic service'],
    helpful: 5,
    notHelpful: 2,
    isVerified: true,
    isHighlighted: false,
    isHidden: false
  },
  {
    id: 7,
    uuid: '77ce123b-57c4-429b-9840-c79f8047d8gg',
    source: 'Google',
    rating: 4,
    title: 'Very good but with minor issues',
    content: 'I had a very positive experience overall. The staff was friendly and knowledgeable. The only issue was a slight delay in processing my order. Despite that, I would still recommend this business.',
    author: 'Robert Garcia',
    authorAvatar: 'https://randomuser.me/api/portraits/men/78.jpg',
    date: '2023-06-20',
    location: 'Online Store',
    status: 'unread',
    sentiment: 'positive',
    tags: ['friendly staff', 'knowledgeable', 'delay'],
    helpful: 9,
    notHelpful: 1,
    isVerified: true,
    isHighlighted: false,
    isHidden: false
  },
  {
    id: 8,
    uuid: '88ce123b-57c4-429b-9840-c79f8047d8hh',
    source: 'Yelp',
    rating: 1,
    title: 'Waste of money and time',
    content: 'I regret making this purchase. The product quality was far below what was advertised, and when I tried to return it, I was given the runaround. Extremely disappointed with the entire experience.',
    author: 'Sophia Martinez',
    authorAvatar: 'https://randomuser.me/api/portraits/women/90.jpg',
    date: '2023-06-15',
    location: 'Downtown Location',
    status: 'flagged',
    sentiment: 'negative',
    tags: ['poor quality', 'return issues', 'misleading'],
    helpful: 14,
    notHelpful: 2,
    isVerified: true,
    isHighlighted: false,
    isHidden: false
  },
  {
    id: 9,
    uuid: '99ce123b-57c4-429b-9840-c79f8047d8ii',
    source: 'Google',
    rating: 5,
    title: 'Best service I\'ve ever received',
    content: 'I am absolutely blown away by the level of service I received. The staff was incredibly attentive and went out of their way to help me find exactly what I needed. The product has exceeded all my expectations.',
    author: 'James Wilson',
    authorAvatar: 'https://randomuser.me/api/portraits/men/91.jpg',
    date: '2023-06-10',
    location: 'Westside Branch',
    response: {
      content: "Thank you for your amazing review, James! We're thrilled to hear that our team provided such outstanding service. We value your business and look forward to serving you again soon!",
      date: '2023-06-11',
      author: 'Management Team'
    },
    status: 'responded',
    sentiment: 'positive',
    tags: ['exceptional service', 'attentive staff', 'exceeded expectations'],
    helpful: 22,
    notHelpful: 0,
    isVerified: true,
    isHighlighted: true,
    isHidden: false
  },
  {
    id: 10,
    uuid: 'aace123b-57c4-429b-9840-c79f8047d8jj',
    source: 'Yelp',
    rating: 2,
    title: 'Disappointing product quality',
    content: 'While the staff was friendly, the product quality was disappointing. It didn\'t last nearly as long as expected and didn\'t perform as advertised. I expected better for the price point.',
    author: 'Amanda Brown',
    authorAvatar: 'https://randomuser.me/api/portraits/women/28.jpg',
    date: '2023-06-05',
    location: 'Eastside Location',
    status: 'unread',
    sentiment: 'negative',
    tags: ['poor quality', 'overpriced', 'underperforming'],
    helpful: 11,
    notHelpful: 3,
    isVerified: true,
    isHighlighted: false,
    isHidden: false
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('date')
const sortOrder = ref('desc')
const sourceFilter = ref('all')
const ratingFilter = ref('all')
const sentimentFilter = ref('all')
const statusFilter = ref('all')
const viewMode = ref('compact') // 'detailed' or 'compact'

// Available sources
const sources = ['all', 'Google', 'Yelp', 'Facebook', 'TripAdvisor', 'Other']

// Available ratings
const ratings = ['all', '5', '4', '3', '2', '1']

// Available sentiments
const sentiments = ['all', 'positive', 'neutral', 'negative']

// Available statuses
const statuses = ['all', 'unread', 'read', 'responded', 'flagged']

// Computed filtered and sorted reviews
const filteredReviews = computed(() => {
  return reviews.value
    .filter(review => {
      // Apply search filter
      const matchesSearch =
        review.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        review.content.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        review.author.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        review.location.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply source filter
      const matchesSource = sourceFilter.value === 'all' || review.source === sourceFilter.value

      // Apply rating filter
      const matchesRating = ratingFilter.value === 'all' || review.rating.toString() === ratingFilter.value

      // Apply sentiment filter
      const matchesSentiment = sentimentFilter.value === 'all' || review.sentiment === sentimentFilter.value

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || review.status === statusFilter.value

      return matchesSearch && matchesSource && matchesRating && matchesSentiment && matchesStatus
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'date') {
        comparison = new Date(b.date).getTime() - new Date(a.date).getTime()
      } else if (sortBy.value === 'rating') {
        comparison = b.rating - a.rating
      } else if (sortBy.value === 'helpful') {
        comparison = b.helpful - a.helpful
      }

      return sortOrder.value === 'asc' ? -comparison : comparison
    })
})

// Pagination
const itemsPerPage = ref(5);
const currentPage = ref(1);

const totalPages = computed(() => {
  return Math.ceil(filteredReviews.value.length / itemsPerPage.value);
});

const paginatedReviews = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  const endIndex = startIndex + itemsPerPage.value;
  return filteredReviews.value.slice(startIndex, endIndex);
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

// Get rating stars
function getRatingStars(rating: number): string[] {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars.push('full');
    } else {
      stars.push('empty');
    }
  }
  return stars;
}

// Get sentiment class
function getSentimentClass(sentiment: string): string {
  switch (sentiment) {
    case 'positive':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'neutral':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    case 'negative':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Get status badge class
function getStatusClass(status: string): string {
  switch (status) {
    case 'responded':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'read':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    case 'unread':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'flagged':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Format date
function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Get source icon
const getSourceIcon = (source: string): string => {
  switch (source) {
    case 'Google':
      return 'i-hugeicons-google'
    case 'Yelp':
      return 'i-hugeicons-yelp'
    case 'Facebook':
      return 'i-hugeicons-facebook'
    case 'TripAdvisor':
      return 'i-hugeicons-tripadvisor'
    default:
      return 'i-hugeicons-globe'
  }
}

// Get source color
const getSourceColor = (source: string): string => {
  switch (source) {
    case 'Google':
      return 'text-blue-600 dark:text-blue-400'
    case 'Yelp':
      return 'text-red-600 dark:text-red-400'
    case 'Facebook':
      return 'text-indigo-600 dark:text-indigo-400'
    case 'TripAdvisor':
      return 'text-green-600 dark:text-green-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

// Calculate summary statistics
const totalReviews = computed(() => reviews.value.length)
const averageRating = computed(() => {
  const sum = reviews.value.reduce((acc, review) => acc + review.rating, 0)
  return (sum / reviews.value.length).toFixed(1)
})
const positiveReviews = computed(() => reviews.value.filter(r => r.sentiment === 'positive').length)
const negativeReviews = computed(() => reviews.value.filter(r => r.sentiment === 'negative').length)
const unreadReviews = computed(() => reviews.value.filter(r => r.status === 'unread').length)
const flaggedReviews = computed(() => reviews.value.filter(r => r.status === 'flagged').length)

// Calculate review distribution by source
const reviewsBySource = computed(() => {
  const distribution: Record<string, number> = {}
  reviews.value.forEach(review => {
    const source = review.source
    distribution[source] = (distribution[source] || 0) + 1
  })
  return distribution
})

// Calculate review distribution by rating
const reviewsByRating = computed(() => {
  const distribution: Record<number, number> = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
  reviews.value.forEach(review => {
    const rating = review.rating
    distribution[rating] = (distribution[rating] || 0) + 1
  })
  return distribution
})

// Calculate review distribution by sentiment
const reviewsBySentiment = computed(() => {
  const distribution: Record<string, number> = {positive: 0, neutral: 0, negative: 0}
  reviews.value.forEach(review => {
    const sentiment = review.sentiment
    distribution[sentiment] = (distribution[sentiment] || 0) + 1
  })
  return distribution
})

// Modal state for review response
const showResponseModal = ref(false)
const currentReview = ref<Review | null>(null)
const responseText = ref('')

function openResponseModal(review: Review | null): void {
  currentReview.value = review
  responseText.value = review?.response?.content || ''
  showResponseModal.value = true
}

function closeResponseModal(): void {
  showResponseModal.value = false
  currentReview.value = null
  responseText.value = ''
}

function submitResponse(): void {
  if (!currentReview.value) return

  const today = new Date().toISOString().split('T')[0] || ''

  // Find the review in the array and update it
  const index = reviews.value.findIndex(r => r.id === currentReview.value?.id)
  if (index !== -1) {
    reviews.value[index]!.response = {
      content: responseText.value,
      date: today,
      author: 'Customer Support Team'
    }
    reviews.value[index]!.status = 'responded'
  }

  closeResponseModal()
}

// Function to mark a review as read
function markAsRead(review: Review): void {
  if (review.status === 'unread') {
    const index = reviews.value.findIndex(r => r.id === review.id)
    if (index !== -1) {
      reviews.value[index]!.status = 'read'
    }
  }
}

// Function to flag a review
function flagReview(review: Review): void {
  const index = reviews.value.findIndex(r => r.id === review.id)
  if (index !== -1) {
    const reviewItem = reviews.value[index]!
    reviewItem.status = reviewItem.status === 'flagged' ? 'read' : 'flagged'
  }
}

// Function to highlight a review
function highlightReview(review: Review): void {
  const index = reviews.value.findIndex(r => r.id === review.id)
  if (index !== -1) {
    const reviewItem = reviews.value[index]!
    reviewItem.isHighlighted = !reviewItem.isHighlighted
  }
}

// Function to hide a review
function hideReview(review: Review): void {
  const index = reviews.value.findIndex(r => r.id === review.id)
  if (index !== -1) {
    const reviewItem = reviews.value[index]!
    reviewItem.isHidden = !reviewItem.isHidden
  }
}

// D3 visualization functions
const renderRatingChart = () => {
  // Clear previous chart
  d3.select('#rating-chart').selectAll('*').remove();

  // Get data
  const data = Object.entries(reviewsByRating.value).map(([rating, count]) => ({
    rating: Number(rating),
    count
  })).sort((a, b) => a.rating - b.rating);

  // Set dimensions
  const width = document.getElementById('rating-chart')?.clientWidth || 300;
  const height = document.getElementById('rating-chart')?.clientHeight || 200;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Create SVG
  const svg = d3.select('#rating-chart')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Create scales
  const xScale = d3.scaleBand()
    .domain(data.map(d => d.rating.toString()))
    .range([0, innerWidth])
    .padding(0.2);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.count) || 0])
    .nice()
    .range([innerHeight, 0]);

  // Create and add x-axis
  svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .style('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('fill', document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280')
    .text((d: string) => d.charAt(0).toUpperCase() + d.slice(1));

  // Create and add y-axis
  svg.append('g')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('d')))
    .selectAll('text')
    .style('font-size', '10px')
    .style('fill', document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280');

  // Create color scale
  const colorScale = d3.scaleLinear<string>()
    .domain([1, 5])
    .range(['#ef4444', '#22c55e']);

  // Add bars
  svg.selectAll('.bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(d.rating.toString()) || 0)
    .attr('y', d => yScale(d.count))
    .attr('width', xScale.bandwidth())
    .attr('height', d => innerHeight - yScale(d.count))
    .attr('fill', d => colorScale(d.rating))
    .attr('rx', 2);

  // Add labels
  svg.selectAll('.label')
    .data(data)
    .enter()
    .append('text')
    .attr('class', 'label')
    .attr('x', d => (xScale(d.rating.toString()) || 0) + xScale.bandwidth() / 2)
    .attr('y', d => yScale(d.count) - 5)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('fill', document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151')
    .text(d => d.count > 0 ? d.count.toString() : '');
};

const renderSentimentChart = () => {
  // Clear previous chart
  d3.select('#sentiment-chart').selectAll('*').remove();

  // Get data
  const data = Object.entries(reviewsBySentiment.value).map(([sentiment, count]) => ({
    sentiment,
    count
  }));

  // Set dimensions
  const width = document.getElementById('sentiment-chart')?.clientWidth || 300;
  const height = document.getElementById('sentiment-chart')?.clientHeight || 200;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Create SVG
  const svg = d3.select('#sentiment-chart')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Create scales
  const xScale = d3.scaleBand()
    .domain(data.map(d => d.sentiment))
    .range([0, innerWidth])
    .padding(0.2);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.count) || 0])
    .nice()
    .range([innerHeight, 0]);

  // Create and add x-axis
  svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .style('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('fill', document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280')
    .text(d => d.charAt(0).toUpperCase() + d.slice(1));

  // Create and add y-axis
  svg.append('g')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('d')))
    .selectAll('text')
    .style('font-size', '10px')
    .style('fill', document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280');

  // Create color scale
  const colorScale = d3.scaleOrdinal<string>()
    .domain(['negative', 'neutral', 'positive'])
    .range(['#ef4444', '#3b82f6', '#22c55e']);

  // Add bars
  svg.selectAll('.bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(d.sentiment) || 0)
    .attr('y', d => yScale(d.count))
    .attr('width', xScale.bandwidth())
    .attr('height', d => innerHeight - yScale(d.count))
    .attr('fill', d => colorScale(d.sentiment))
    .attr('rx', 2);

  // Add labels
  svg.selectAll('.label')
    .data(data)
    .enter()
    .append('text')
    .attr('class', 'label')
    .attr('x', d => (xScale(d.sentiment) || 0) + xScale.bandwidth() / 2)
    .attr('y', d => yScale(d.count) - 5)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('fill', document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151')
    .text(d => d.count > 0 ? d.count.toString() : '');
};

const renderSourceChart = () => {
  // Clear previous chart
  d3.select('#source-chart').selectAll('*').remove();

  // Get data
  const data = Object.entries(reviewsBySource.value).map(([source, count]) => ({
    source,
    count
  }));

  // Set dimensions
  const width = document.getElementById('source-chart')?.clientWidth || 300;
  const height = document.getElementById('source-chart')?.clientHeight || 200;
  const radius = Math.min(width, height) / 2 - 40;

  // Create SVG
  const svg = d3.select('#source-chart')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);

  // Create color scale
  const colorScale = d3.scaleOrdinal<string>()
    .domain(data.map(d => d.source))
    .range(['#3b82f6', '#ef4444', '#8b5cf6', '#22c55e', '#f59e0b']);

  // Create pie chart
  const pie = d3.pie<{source: string, count: number}>()
    .value(d => d.count)
    .sort(null);

  const arc = d3.arc<d3.PieArcDatum<{source: string, count: number}>>()
    .innerRadius(radius * 0.5) // Donut chart
    .outerRadius(radius);

  // Add arcs
  const pieData = pie(data);
  const arcGroups = svg.selectAll('.arc')
    .data(pieData)
    .enter()
    .append('g')
    .attr('class', 'arc');

  arcGroups.append('path')
    .attr('d', arc)
    .attr('fill', d => colorScale(d.data.source))
    .attr('stroke', document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff')
    .attr('stroke-width', 1);

  // Add labels
  const arcLabel = d3.arc<d3.PieArcDatum<{source: string, count: number}>>()
    .innerRadius(radius * 0.7)
    .outerRadius(radius * 0.7);

  arcGroups.append('text')
    .attr('transform', d => `translate(${arcLabel.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', 'bold')
    .style('fill', document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151')
    .text(d => d.data.count > 0 ? d.data.count.toString() : '');

  // Add legend
  const legend = svg.selectAll('.legend')
    .data(data)
    .enter()
    .append('g')
    .attr('class', 'legend')
    .attr('transform', (d, i) => `translate(${radius + 10},${-radius + 20 + i * 20})`);

  legend.append('rect')
    .attr('width', 12)
    .attr('height', 12)
    .attr('fill', d => colorScale(d.source));

  legend.append('text')
    .attr('x', 20)
    .attr('y', 10)
    .style('font-size', '10px')
    .style('fill', document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151')
    .text(d => d.source);
};

// Initialize D3 charts on component mount
onMounted(() => {
  // Render initial charts
  renderRatingChart();
  renderSentimentChart();
  renderSourceChart();

  // Re-render charts when window is resized
  window.addEventListener('resize', () => {
    renderRatingChart();
    renderSentimentChart();
    renderSourceChart();
  });

  // Re-render charts when theme changes
  const observer = new MutationObserver(() => {
    renderRatingChart();
    renderSentimentChart();
    renderSourceChart();
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });

  // Re-render charts when reviews data changes
  watch([reviewsByRating, reviewsBySentiment, reviewsBySource], () => {
    renderRatingChart();
    renderSentimentChart();
    renderSourceChart();
  });
})
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header section -->
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Customer Reviews</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Monitor and respond to customer reviews from Google, Yelp, and other platforms
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openResponseModal(null)"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-mail-reply-01 h-5 w-5 mr-1"></div>
              Respond to Review
            </button>
          </div>
        </div>

        <!-- Summary cards -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Total reviews card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-blue-100 p-2 dark:bg-blue-900">
                    <div class="i-hugeicons-star h-6 w-6 text-blue-600 dark:text-blue-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Reviews</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalReviews }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Average rating card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-yellow-100 p-2 dark:bg-yellow-900">
                    <div class="i-hugeicons-chart-average h-6 w-6 text-yellow-600 dark:text-yellow-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Average Rating</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ averageRating }} / 5</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Positive reviews card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-green-100 p-2 dark:bg-green-900">
                    <div class="i-hugeicons-thumbs-up h-6 w-6 text-green-600 dark:text-green-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Positive Reviews</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ positiveReviews }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Negative reviews card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-red-100 p-2 dark:bg-red-900">
                    <div class="i-hugeicons-thumbs-down h-6 w-6 text-red-600 dark:text-red-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Negative Reviews</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ negativeReviews }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Visualization section -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <!-- Rating distribution chart -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">Rating Distribution</h3>
              <div id="rating-chart" class="h-48 mt-4"></div>
            </div>
          </div>

          <!-- Sentiment distribution chart -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">Sentiment Analysis</h3>
              <div id="sentiment-chart" class="h-48 mt-4"></div>
            </div>
          </div>

          <!-- Source distribution chart -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">Review Sources</h3>
              <div id="source-chart" class="h-48 mt-4"></div>
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
              placeholder="Search reviews..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <!-- Source filter -->
            <select
              v-model="sourceFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Sources</option>
              <option v-for="source in sources.filter(s => s !== 'all')" :key="source" :value="source">{{ source }}</option>
            </select>

            <!-- Rating filter -->
            <select
              v-model="ratingFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Ratings</option>
              <option v-for="rating in ratings.filter(r => r !== 'all')" :key="rating" :value="rating">{{ rating }} Stars</option>
            </select>

            <!-- Sentiment filter -->
            <select
              v-model="sentimentFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>

            <!-- Status filter -->
            <select
              v-model="statusFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Statuses</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="responded">Responded</option>
              <option value="flagged">Flagged</option>
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
            @click="toggleSort('date')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'date' }"
          >
            Date
            <span v-if="sortBy === 'date'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('rating')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'rating' }"
          >
            Rating
            <span v-if="sortBy === 'rating'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('helpful')"
            class="flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'helpful' }"
          >
            Helpful
            <span v-if="sortBy === 'helpful'" class="ml-1">
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
                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Review</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Source</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Rating</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Sentiment</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Date</th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
              <tr v-if="paginatedReviews.length === 0">
                <td colspan="7" class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No reviews found. Try adjusting your search or filter.
                </td>
              </tr>
              <tr v-for="review in paginatedReviews" :key="review.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div class="flex items-center">
                    <div class="h-10 w-10 flex-shrink-0">
                      <img v-if="review.authorAvatar" class="h-10 w-10 rounded-full" :src="review.authorAvatar" alt="" />
                      <div v-else class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <div class="i-hugeicons-user h-6 w-6 text-gray-500"></div>
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="font-medium text-gray-900 dark:text-white">{{ review.title }}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">{{ review.author }} - {{ review.location }}</div>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <div class="flex items-center">
                    <div :class="getSourceIcon(review.source) + ' h-4 w-4 mr-2 ' + getSourceColor(review.source)"></div>
                    {{ review.source }}
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <div class="flex items-center">
                    <div v-for="(star, index) in getRatingStars(review.rating)" :key="index" class="mr-0.5">
                      <div v-if="star === 'full'" class="i-hugeicons-star h-4 w-4 text-yellow-400"></div>
                      <div v-else class="i-hugeicons-star h-4 w-4 text-gray-300 dark:text-gray-600"></div>
                    </div>
                    <span class="ml-1">{{ review.rating }}.0</span>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span :class="[getSentimentClass(review.sentiment), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium w-fit']">
                    {{ review.sentiment.charAt(0).toUpperCase() + review.sentiment.slice(1) }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span :class="[getStatusClass(review.status), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium w-fit']">
                    {{ review.status.charAt(0).toUpperCase() + review.status.slice(1) }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {{ formatDate(review.date) }}
                </td>
                <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div class="flex justify-end space-x-2">
                    <button
                      v-if="review.status !== 'responded'"
                      @click="openResponseModal(review)"
                      class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-all duration-150"
                      title="Respond"
                    >
                      <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                      <span class="sr-only">Respond</span>
                    </button>
                    <button
                      v-if="review.status === 'unread'"
                      @click="markAsRead(review)"
                      class="text-gray-400 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 transition-all duration-150"
                      title="Mark as Read"
                    >
                      <div class="i-hugeicons-checkmark-circle-02 h-5 w-5"></div>
                      <span class="sr-only">Mark as Read</span>
                    </button>
                    <button
                      @click="flagReview(review)"
                      class="text-gray-400 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 transition-all duration-150"
                      :title="review.status === 'flagged' ? 'Unflag' : 'Flag'"
                    >
                      <div class="i-hugeicons-flag-01 h-5 w-5"></div>
                      <span class="sr-only">Flag</span>
                    </button>
                    <button
                      @click="highlightReview(review)"
                      class="text-gray-400 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 transition-all duration-150"
                      :title="review.isHighlighted ? 'Remove Highlight' : 'Highlight'"
                    >
                      <div :class="review.isHighlighted ? 'i-hugeicons-star' : 'i-hugeicons-star'" class="h-5 w-5"></div>
                      <span class="sr-only">Highlight</span>
                    </button>
                    <button
                      @click="hideReview(review)"
                      class="text-gray-400 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-all duration-150"
                      :title="review.isHidden ? 'Unhide' : 'Hide'"
                    >
                      <div :class="review.isHidden ? 'i-hugeicons-eye-off' : 'i-hugeicons-eye'" class="h-5 w-5"></div>
                      <span class="sr-only">Hide</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Detailed view (cards) -->
        <div v-else class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div v-if="paginatedReviews.length === 0" class="col-span-full py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No reviews found. Try adjusting your search or filter.
          </div>
          <div
            v-for="review in paginatedReviews"
            :key="review.id"
            class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800"
            :class="{ 'ring-2 ring-yellow-400': review.isHighlighted, 'opacity-60': review.isHidden }"
          >
            <div class="p-5">
              <!-- Review header -->
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <div class="h-10 w-10 flex-shrink-0">
                    <img v-if="review.authorAvatar" class="h-10 w-10 rounded-full" :src="review.authorAvatar" alt="" />
                    <div v-else class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <div class="i-hugeicons-user h-6 w-6 text-gray-500"></div>
                    </div>
                  </div>
                  <div class="ml-3">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">{{ review.author }}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">{{ review.location }}</div>
                  </div>
                </div>
                <div class="flex items-center">
                  <div :class="getSourceIcon(review.source) + ' h-5 w-5 mr-2 ' + getSourceColor(review.source)"></div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(review.date) }}</span>
                </div>
              </div>

              <!-- Rating -->
              <div class="mt-3 flex items-center">
                <div class="flex">
                  <div v-for="(star, index) in getRatingStars(review.rating)" :key="index" class="mr-0.5">
                    <div v-if="star === 'full'" class="i-hugeicons-star h-5 w-5 text-yellow-400"></div>
                    <div v-else class="i-hugeicons-star h-5 w-5 text-gray-300 dark:text-gray-600"></div>
                  </div>
                </div>
                <span class="ml-2 text-sm text-gray-500 dark:text-gray-400">{{ review.rating }}.0</span>
                <span
                  :class="[getSentimentClass(review.sentiment), 'ml-auto inline-flex items-center rounded-full px-2 py-1 text-xs font-medium']"
                >
                  {{ review.sentiment.charAt(0).toUpperCase() + review.sentiment.slice(1) }}
                </span>
                <span
                  :class="[getStatusClass(review.status), 'ml-2 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium']"
                >
                  {{ review.status.charAt(0).toUpperCase() + review.status.slice(1) }}
                </span>
              </div>

              <!-- Review title and content -->
              <div class="mt-3">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ review.title }}</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-3">{{ review.content }}</p>
                <button
                  v-if="review.content.length > 150"
                  class="mt-1 text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Read more
                </button>
              </div>

              <!-- Tags -->
              <div v-if="review.tags && review.tags.length > 0" class="mt-3 flex flex-wrap gap-1">
                <span
                  v-for="tag in review.tags"
                  :key="tag"
                  class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-blue-gray-700 dark:text-gray-300"
                >
                  {{ tag }}
                </span>
              </div>

              <!-- Response section -->
              <div v-if="review.response" class="mt-4 rounded-md bg-gray-50 p-3 dark:bg-blue-gray-700">
                <div class="flex items-center">
                  <div class="h-8 w-8 flex-shrink-0">
                    <img class="h-8 w-8 rounded-full" src="/images/logos/logo.svg" alt="Your Business" />
                  </div>
                  <div class="ml-3">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">Your Business</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(review.response.date) }}</div>
                  </div>
                </div>
                <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{{ review.response.content }}</p>
              </div>

              <!-- Helpful metrics -->
              <div class="mt-4 flex items-center text-xs text-gray-500 dark:text-gray-400">
                <div class="flex items-center">
                  <div class="i-hugeicons-thumb-up h-4 w-4 mr-1"></div>
                  <span>{{ review.helpful || 0 }} helpful</span>
                </div>
                <div class="ml-4 flex items-center">
                  <div class="i-hugeicons-thumb-down h-4 w-4 mr-1"></div>
                  <span>{{ review.notHelpful || 0 }} not helpful</span>
                </div>
                <div v-if="review.isVerified" class="ml-auto flex items-center text-green-600 dark:text-green-400">
                  <div class="i-hugeicons-check-verified h-4 w-4 mr-1"></div>
                  <span>Verified</span>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="mt-4 flex justify-between">
                <button
                  v-if="review.status !== 'responded'"
                  @click="openResponseModal(review)"
                  class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                >
                  <div class="i-hugeicons-message-text-edit h-4 w-4 mr-1"></div>
                  Respond
                </button>
                <button
                  v-if="review.status === 'unread'"
                  @click="markAsRead(review)"
                  class="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
                >
                  <div class="i-hugeicons-checkmark-circle-02 h-4 w-4 mr-1"></div>
                  Mark as Read
                </button>
                <div class="flex space-x-2">
                  <button
                    @click="flagReview(review)"
                    class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:bg-blue-gray-700 dark:text-gray-300 dark:hover:bg-blue-gray-600"
                    :class="{ 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300': review.status === 'flagged' }"
                  >
                    <div class="i-hugeicons-flag-01 h-4 w-4 mr-1"></div>
                    {{ review.status === 'flagged' ? 'Unflag' : 'Flag' }}
                  </button>
                  <button
                    @click="highlightReview(review)"
                    class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:bg-blue-gray-700 dark:text-gray-300 dark:hover:bg-blue-gray-600"
                    :class="{ 'bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-300': review.isHighlighted }"
                  >
                    <div :class="review.isHighlighted ? 'i-hugeicons-star' : 'i-hugeicons-star'" class="h-4 w-4 mr-1"></div>
                    {{ review.isHighlighted ? 'Unhighlight' : 'Highlight' }}
                  </button>
                  <button
                    @click="hideReview(review)"
                    class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:bg-blue-gray-700 dark:text-gray-300 dark:hover:bg-blue-gray-600"
                    :class="{ 'bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300': review.isHidden }"
                  >
                    <div :class="review.isHidden ? 'i-hugeicons-eye-off' : 'i-hugeicons-eye'" class="h-4 w-4 mr-1"></div>
                    {{ review.isHidden ? 'Unhide' : 'Hide' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="mt-6 flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6 dark:border-gray-700">
          <div class="flex flex-1 justify-between sm:hidden">
            <button
              @click="currentPage > 1 ? currentPage-- : null"
              :disabled="currentPage === 1"
              class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-blue-gray-800 dark:text-white dark:hover:bg-blue-gray-700"
            >
              Previous
            </button>
            <button
              @click="currentPage < totalPages ? currentPage++ : null"
              :disabled="currentPage === totalPages"
              class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-blue-gray-800 dark:text-white dark:hover:bg-blue-gray-700"
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
                <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredReviews.length) }}</span>
                of
                <span class="font-medium">{{ filteredReviews.length }}</span>
                results
              </p>
            </div>
            <div>
              <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  @click="currentPage > 1 ? currentPage-- : null"
                  :disabled="currentPage === 1"
                  class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <span class="sr-only">Previous</span>
                  <div class="i-hugeicons-chevron-left h-5 w-5"></div>
                </button>
                <button
                  v-for="page in displayedPages"
                  :key="page"
                  @click="currentPage = page"
                  :class="[
                    page === currentPage
                      ? 'relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                      : 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-700',
                    'focus:z-20 focus:outline-offset-0'
                  ]"
                >
                  {{ page }}
                </button>
                <button
                  @click="currentPage < totalPages ? currentPage++ : null"
                  :disabled="currentPage === totalPages"
                  class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed dark:ring-gray-600 dark:text-gray-400 dark:hover:bg-blue-gray-700"
                >
                  <span class="sr-only">Next</span>
                  <div class="i-hugeicons-chevron-right h-5 w-5"></div>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Response modal -->
  <div v-if="showResponseModal" class="fixed inset-0 z-10 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeResponseModal"></div>
      <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
        <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
          <button
            type="button"
            @click="closeResponseModal"
            class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-300 dark:hover:text-gray-200"
          >
            <span class="sr-only">Close</span>
            <div class="i-hugeicons-x-mark h-6 w-6"></div>
          </button>
        </div>
        <div class="sm:flex sm:items-start">
          <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-blue-900">
            <div class="i-hugeicons-mail-reply-01 h-6 w-6 text-blue-600 dark:text-blue-300"></div>
          </div>
          <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
              {{ currentReview ? 'Respond to Review' : 'Create Response Template' }}
            </h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ currentReview ? 'Write a thoughtful response to this customer review.' : 'Create a response template that can be used for future reviews.' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Review details (if responding to a specific review) -->
        <div v-if="currentReview" class="mt-4 rounded-md bg-gray-50 p-3 dark:bg-blue-gray-700">
          <div class="flex items-center">
            <div class="h-8 w-8 flex-shrink-0">
              <img v-if="currentReview.authorAvatar" class="h-8 w-8 rounded-full" :src="currentReview.authorAvatar" alt="" />
              <div v-else class="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                <div class="i-hugeicons-user h-5 w-5 text-gray-500"></div>
              </div>
            </div>
            <div class="ml-3">
              <div class="text-sm font-medium text-gray-900 dark:text-white">{{ currentReview.author }}</div>
              <div class="flex items-center">
                <div v-for="(star, index) in getRatingStars(currentReview.rating)" :key="index" class="mr-0.5">
                  <div v-if="star === 'full'" class="i-hugeicons-star h-4 w-4 text-yellow-400"></div>
                  <div v-else class="i-hugeicons-star h-4 w-4 text-gray-300 dark:text-gray-600"></div>
                </div>
                <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">{{ formatDate(currentReview.date) }}</span>
              </div>
            </div>
          </div>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">{{ currentReview.content }}</p>
        </div>

        <!-- Response form -->
        <div class="mt-4">
          <label for="response" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Your response</label>
          <div class="mt-1">
            <textarea
              id="response"
              v-model="responseText"
              rows="4"
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Write your response here..."
            ></textarea>
          </div>
        </div>

        <!-- Response templates -->
        <div class="mt-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Response templates</label>
          <div class="mt-1 grid grid-cols-1 gap-2">
            <button
              @click="responseText = 'Thank you for your positive feedback! We appreciate your kind words and are delighted that you had a great experience with us. We look forward to serving you again soon!'"
              class="text-left rounded-md bg-gray-50 p-2 text-xs text-gray-700 hover:bg-gray-100 dark:bg-blue-gray-700 dark:text-gray-300 dark:hover:bg-blue-gray-600"
            >
              <span class="font-medium">Positive Review Response</span>
              <p class="mt-1 truncate">Thank you for your positive feedback! We appreciate your kind words...</p>
            </button>
            <button
              @click="responseText = 'Thank you for bringing this to our attention. We apologize for your negative experience and would like to make things right. Please contact our customer service team directly so we can address your concerns personally.'"
              class="text-left rounded-md bg-gray-50 p-2 text-xs text-gray-700 hover:bg-gray-100 dark:bg-blue-gray-700 dark:text-gray-300 dark:hover:bg-blue-gray-600"
            >
              <span class="font-medium">Negative Review Response</span>
              <p class="mt-1 truncate">Thank you for bringing this to our attention. We apologize for your negative experience...</p>
            </button>
            <button
              @click="responseText = 'Thank you for your feedback. We appreciate you taking the time to share your thoughts with us. Your input helps us improve our services, and we hope to exceed your expectations on your next visit.'"
              class="text-left rounded-md bg-gray-50 p-2 text-xs text-gray-700 hover:bg-gray-100 dark:bg-blue-gray-700 dark:text-gray-300 dark:hover:bg-blue-gray-600"
            >
              <span class="font-medium">Neutral Review Response</span>
              <p class="mt-1 truncate">Thank you for your feedback. We appreciate you taking the time to share your thoughts...</p>
            </button>
          </div>
        </div>

        <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            @click="submitResponse"
            class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
          >
            Submit Response
          </button>
          <button
            type="button"
            @click="closeResponseModal"
            class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
