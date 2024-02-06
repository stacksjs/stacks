import { useFetch } from '@raycast/utils'
import { API_URL } from '../config'

export function useVersions() {
  const url = `${API_URL}/versions`
  const { data, isLoading } = useFetch<{ versions: string[] }>(url, {
    method: 'GET',
  })

  return {
    versions: data?.versions,
    isLoading,
  }
}
