export const isAuthenticated = computed(() => {
  const fetch = useHttpFetch()

  if (typeof window !== 'undefined') {
    const token = fetch.token.value || window.localStorage.getItem('bearerToken')

    return token !== null
  }
})
