const PAGE = 1000

// PostgREST caps any select at 1000 rows and truncates silently, so page
// through until a short page comes back. The builder must apply `.range(from, to)`
// and a stable `.order(...)` (otherwise pages can overlap or skip rows).
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

// `.in(col, ids)` is sent in the URL — a few hundred UUIDs blow past the
// request-line limit and the query fails (returning no rows). Split the ids
// into URL-safe chunks and run them in parallel.
export async function fetchInChunks<T>(
  ids: string[],
  build: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>,
  chunkSize = 150,
): Promise<T[]> {
  const unique = [...new Set(ids)]
  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += chunkSize) chunks.push(unique.slice(i, i + chunkSize))
  const results = await Promise.all(chunks.map(async c => {
    const { data, error } = await build(c)
    if (error) throw error
    return data ?? []
  }))
  return results.flat()
}
