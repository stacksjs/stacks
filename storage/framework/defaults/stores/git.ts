const owner = 'stacksjs'
const repo = 'stacks'
const numberOfCommits = 10

// Assuming you are using a library like Axios for HTTP requests
const apiUrl = `https://api.github.com/repos/${owner}/${repo}`

const token = ''

declare const defineStore: any
declare const useHttpFetch: any
declare const acceptHMRUpdate: any

export const useGitStore = defineStore('git', {
  state: (): any => {
    return {
      commitLists: [] as any[],
      workflowRuns: [] as any[],
      workflowRun: {} as any,
    }
  },

  actions: {
    async fetchCommits(this: any): Promise<void> {
      const fetch = await useHttpFetch(apiUrl)

      fetch.setToken(token)

      const response = await fetch.get(`/commits?per_page=${numberOfCommits}`)

      this.commitLists = response
    },

    async fetchWorkflowActions(this: any): Promise<void> {
      const fetch = await useHttpFetch(apiUrl)

      fetch.setToken(token)

      const response = await fetch.get(`/actions/runs?per_page=${numberOfCommits}`)

      this.workflowRuns = response.workflow_runs
    },

    async fetchWorkflowAction(this: any, id: number): Promise<void> {
      const fetch = await useHttpFetch(apiUrl)

      fetch.setToken(token)

      const response = await fetch.get(`/actions/runs/${id}`)

      this.workflowRun = response
    },
  },

  getters: {
    getCommits(state: any): any[] {
      return state.commitLists
    },

    hasCommits(state: any) {
      return state.commitLists.length
    },

    hasWorkflowRuns(state: any) {
      return state.workflowRuns.length
    },

    getWorkflowRuns(state: any): any[] {
      return state.workflowRuns
    },
  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGitStore, import.meta.hot))
