import type { GitHubCommit, WorkflowRun } from '../types/git'

const owner = 'stacksjs'
const repo = 'stacks'
const numberOfCommits = 10

// Assuming you are using a library like Axios for HTTP requests
const apiUrl = `https://api.github.com/repos/${owner}/${repo}`

const token = ''

export const useGitStore = defineStore('git', {
  state: (): any => {
    return {
      commitLists: [] as GitHubCommit[],
      workflowRuns: [] as WorkflowRun[],
      workflowRun: {} as WorkflowRun,
    }
  },

  actions: {
    async fetchCommits(): Promise<void> {
      const fetch = await useHttpFetch(apiUrl)

      fetch.setToken(token)

      const response = await fetch.get(`/commits?per_page=${numberOfCommits}`)

      this.commitLists = response
    },

    async fetchWorkflowActions(): Promise<void> {
      const fetch = await useHttpFetch(apiUrl)

      fetch.setToken(token)

      const response = await fetch.get(`/actions/runs?per_page=${numberOfCommits}`)

      this.workflowRuns = response.workflow_runs
    },

    async fetchWorkflowAction(id: number): Promise<void> {
      const fetch = await useHttpFetch(apiUrl)

      fetch.setToken(token)

      const response = await fetch.get(`/actions/runs/${id}`)

      this.workflowRun = response
    },
  },

  getters: {
    getCommits(state): GitHubCommit[] {
      return state.commitLists
    },

    hasCommits(state) {
      return state.commitLists.length
    },

    hasWorkflowRuns(state) {
      return state.workflowRuns.length
    },

    getWorkflowRuns(state): GitHubCommit[] {
      return state.workflowRuns
    },
  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGitStore, import.meta.hot))
