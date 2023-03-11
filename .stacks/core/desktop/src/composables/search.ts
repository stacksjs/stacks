const client = useMeilisearch()

async function search(index: string, params: any) {
  const filter = params.filters ? [params?.filters] : []

  const sort = params.sort ? params.sort : ['id:asc']

  const offsetVal = ((params.page * params.perPage) - 20) || 0

  const options: any = { filter, sort, limit: params.perPage, offset: offsetVal < 0 ? 0 : offsetVal, facets: params.facetDistribution }

  return await client.index(index)
    .search(params.query, options)
}

async function getFilterableAttributes(index: string) {
  return await client.index(index).getFilterableAttributes()
}

export {
  search,
  getFilterableAttributes,
}
