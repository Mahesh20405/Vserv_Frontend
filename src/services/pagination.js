export function readPaginatedData(payload, fallback = {}) {
  const page = fallback.page ?? 1
  const size = fallback.size ?? 10

  if (Array.isArray(payload)) {
    const totalElements = payload.length
    return {
      content: payload,
      page,
      size,
      totalElements,
      totalPages: Math.max(1, Math.ceil(totalElements / size)),
    }
  }

  const content = Array.isArray(payload?.content) ? payload.content : []
  const totalElements = Number(payload?.totalElements ?? content.length)
  const resolvedSize = Number(payload?.size ?? size)
  const fallbackTotalPages = Math.ceil(totalElements / resolvedSize) || 1

  return {
    content,
    page: Number(payload?.page ?? page),
    size: resolvedSize,
    totalElements,
    totalPages: Math.max(1, Number(payload?.totalPages ?? fallbackTotalPages)),
  }
}
