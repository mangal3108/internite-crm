export async function fetchAllPages(fetchPage, pageSize = 200) {
  const firstPage = await fetchPage({ page: 0, size: pageSize })
  const rows = Array.isArray(firstPage?.content) ? [...firstPage.content] : []
  const totalPages = Math.max(1, Number(firstPage?.totalPages ?? 1))
  const total = Number(firstPage?.total ?? rows.length)

  if (totalPages > 1) {
    const pageRequests = []
    for (let page = 1; page < totalPages; page += 1) {
      pageRequests.push(fetchPage({ page, size: pageSize }))
    }
    const remainingPages = await Promise.all(pageRequests)
    for (const pageData of remainingPages) {
      rows.push(...(Array.isArray(pageData?.content) ? pageData.content : []))
    }
  }

  return { rows, total }
}
