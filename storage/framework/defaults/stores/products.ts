import type { Products, ProductCategories } from '../functions/types'

const apiUrl = 'http://localhost:3008'

export const useProductsStore = defineStore('products', () => {
  // State
  const loadingStates = ref<Record<string, boolean>>({})
  const products = ref<Products[]>([])
  const categories = ref<ProductCategories[]>([])
  const currentProduct = ref<Products | null>(null)
  const searchQuery = ref('')
  const sortBy = ref('dateAdded')
  const sortOrder = ref('desc')
  const categoryFilter = ref('all')
  const statusFilter = ref('all')
  const currentPage = ref(1)
  const itemsPerPage = ref(8)

  // Computed properties
  const getProducts = computed(() => products.value)
  const getCategories = computed(() => categories.value)
  const getCurrentProduct = computed(() => currentProduct.value)
  const getSearchQuery = computed(() => searchQuery.value)
  const getSortBy = computed(() => sortBy.value)
  const getSortOrder = computed(() => sortOrder.value)
  const getCategoryFilter = computed(() => categoryFilter.value)
  const getStatusFilter = computed(() => statusFilter.value)
  const getCurrentPage = computed(() => currentPage.value)
  const getItemsPerPage = computed(() => itemsPerPage.value)

  const isLoading = computed(() => Object.keys(loadingStates.value).length > 0)

  // Filtered and sorted products
  const filteredProducts = computed(() => {
    return products.value
      .filter((product: Products) => {
        // Apply search filter
        const matchesSearch =
          product.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          product.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          product.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.value.toLowerCase()))

        // Apply category filter
        const matchesCategory = categoryFilter.value === 'all' || product.category === categoryFilter.value

        // Apply status filter
        const matchesStatus = statusFilter.value === 'all' || product.status === statusFilter.value

        return matchesSearch && matchesCategory && matchesStatus
      })
      .sort((a: Products, b: Products) => {
        // Apply sorting
        let comparison = 0
        if (sortBy.value === 'dateAdded') {
          comparison = new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
        } else if (sortBy.value === 'price') {
          const aPrice = a.salePrice !== null ? a.salePrice : a.price
          const bPrice = b.salePrice !== null ? b.salePrice : b.price
          comparison = aPrice - bPrice
        } else if (sortBy.value === 'name') {
          comparison = a.name.localeCompare(b.name)
        } else if (sortBy.value === 'rating') {
          comparison = a.rating - b.rating
        }

        return sortOrder.value === 'asc' ? comparison : -comparison
      })
  })

  // Paginated products
  const paginatedProducts = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value
    const end = start + itemsPerPage.value
    return filteredProducts.value.slice(start, end)
  })

  const totalPages = computed(() => Math.ceil(filteredProducts.value.length / itemsPerPage.value))

  // API Functions
  async function fetchProducts(): Promise<Products[]> {
    setLoadingState('fetchProducts')
    
    try {
      const response = await fetch(`${apiUrl}/commerce/products`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const { data } = await response.json() as { data: Products[] }

      if (Array.isArray(data)) {
        products.value = data
        removeLoadingState('fetchProducts')
        return data
      } else {
        console.error('Expected array of products but received:', typeof data)
        removeLoadingState('fetchProducts')
        return []
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      removeLoadingState('fetchProducts')
      return []
    }
  }

  async function createProduct(product: Omit<Products, 'id'>): Promise<Products | null> {
    setLoadingState('createProduct')
    
    try {
      const response = await fetch(`${apiUrl}/commerce/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(product),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const { data } = await response.json() as { data: Products }
      if (data) {
        products.value = [...products.value, data]
        removeLoadingState('createProduct')
        return data
      }
      removeLoadingState('createProduct')
      return null
    } catch (error) {
      console.error('Error creating product:', error)
      removeLoadingState('createProduct')
      return null
    }
  }

  async function updateProduct(product: Products): Promise<Products | null> {
    setLoadingState('updateProduct')
    
    try {
      const response = await fetch(`${apiUrl}/commerce/products/${product.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(product),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const { data } = await response.json() as { data: Products }
      if (data) {
        const index = products.value.findIndex(p => p.id === product.id)
        if (index !== -1) {
          products.value = [
            ...products.value.slice(0, index),
            data,
            ...products.value.slice(index + 1),
          ]
        }
        removeLoadingState('updateProduct')
        return data
      }
      removeLoadingState('updateProduct')
      return null
    } catch (error) {
      console.error('Error updating product:', error)
      removeLoadingState('updateProduct')
      return null
    }
  }

  async function deleteProduct(id: number): Promise<boolean> {
    setLoadingState('deleteProduct')
    
    try {
      const response = await fetch(`${apiUrl}/commerce/products/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      products.value = products.value.filter(p => p.id !== id)
      removeLoadingState('deleteProduct')
      return true
    } catch (error) {
      console.error('Error deleting product:', error)
      removeLoadingState('deleteProduct')
      return false
    }
  }

  // Category management
  function updateCategories(): void {
    const categoryMap = new Map<string, number>()

    products.value.forEach((product: Products) => {
      const count = categoryMap.get(product.category) || 0
      categoryMap.set(product.category, count + 1)
    })

    categories.value = Array.from(categoryMap.entries()).map(([name, count], index) => ({
      id: index + 1,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      count
    }))
  }

  // Filter and sort actions
  function setSearchQuery(query: string): void {
    searchQuery.value = query
    currentPage.value = 1
  }

  function setSortBy(column: string): void {
    if (sortBy.value === column) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value = column
      sortOrder.value = 'desc'
    }
  }

  function setCategoryFilter(category: string): void {
    categoryFilter.value = category
    currentPage.value = 1
  }

  function setStatusFilter(status: string): void {
    statusFilter.value = status
    currentPage.value = 1
  }

  function setCurrentPage(page: number): void {
    currentPage.value = page
  }

  function setItemsPerPage(items: number): void {
    itemsPerPage.value = items
    currentPage.value = 1
  }

  function nextPage(): void {
    if (currentPage.value < totalPages.value) {
      currentPage.value++
    }
  }

  function previousPage(): void {
    if (currentPage.value > 1) {
      currentPage.value--
    }
  }

  // Product actions
  function setCurrentProduct(product: Products | null): void {
    currentProduct.value = product
  }

  function viewProduct(product: Products): void {
    console.log('View product:', product)
    // Implement view product logic
  }

  function editProduct(product: Products): void {
    console.log('Edit product:', product)
    setCurrentProduct(product)
    // Implement edit product logic
  }

  // Loading state management
  function setLoadingState(statusKey: string): void {
    loadingStates.value[statusKey] = true
  }

  function removeLoadingState(statusKey: string): void {
    delete loadingStates.value[statusKey]
  }

  function isStateLoading(statusKey: string): boolean {
    return loadingStates.value[statusKey] || false
  }

  // Initialize categories when products change
  watch(products, () => {
    updateCategories()
  }, { immediate: true })

  return {
    // State
    products,
    categories,
    currentProduct,
    searchQuery,
    sortBy,
    sortOrder,
    categoryFilter,
    statusFilter,
    currentPage,
    itemsPerPage,
    loadingStates,

    // Computed
    getProducts,
    getCategories,
    getCurrentProduct,
    getSearchQuery,
    getSortBy,
    getSortOrder,
    getCategoryFilter,
    getStatusFilter,
    getCurrentPage,
    getItemsPerPage,
    isLoading,
    filteredProducts,
    paginatedProducts,
    totalPages,

    // Actions
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    setSearchQuery,
    setSortBy,
    setCategoryFilter,
    setStatusFilter,
    setCurrentPage,
    setItemsPerPage,
    nextPage,
    previousPage,
    setCurrentProduct,
    viewProduct,
    editProduct,
    setLoadingState,
    removeLoadingState,
    isStateLoading,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useProductsStore as any, import.meta.hot)) 