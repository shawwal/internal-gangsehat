'use client'

import { useState } from 'react'

export function usePagination(defaultPageSize = 10) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  function reset() {
    setPage(1)
  }

  function range(total: number) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    return { from, to, totalPages: Math.ceil(total / pageSize) }
  }

  return { page, setPage, pageSize, setPageSize, reset, range }
}
