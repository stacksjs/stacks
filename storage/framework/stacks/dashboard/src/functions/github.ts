import { useHttpFetch } from '@stacksjs/api'

import { GithubCommit } from '../types';
import { ref } from 'vue'

export function useGithub() {
    const commitLists: Ref<GithubCommit[]> = ref([])

    async function getCommits() {
        const fetch = await useHttpFetch()

        fetch.setToken('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')
        // Assuming you are using a library like Axios for HTTP requests
        const owner = 'stacksjs';
        const repo = 'stacks';
        const numberOfCommits = 10;
        

        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${numberOfCommits}`;

        // You might need to include authentication, depending on the repository's visibility
        // For public repositories, you might not need authentication
        // For private repositories, you'll need to use a personal access token

        // Example with authentication (replace 'YOUR_ACCESS_TOKEN' with your actual token)
        // const headers = { Authorization: 'Bearer YOUR_ACCESS_TOKEN' };
        // const response = await axios.get(apiUrl, { headers });

        // Example without authentication (for public repositories)
        const response = await fetch.get(apiUrl);

        console.log(response)

        const commitList = response.data;

        // Now 'commitList' contains information about the latest commits
        console.log(commitList);

    }

    return { getCommits }
}


useGithub().getCommits()