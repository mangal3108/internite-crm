export const normalizeSearchText = (value) =>
  String(value ?? '').trim().toLowerCase()

export const normalizeSearchDigits = (value) =>
  String(value ?? '').replace(/\D/g, '')

export const fieldMatchesSearch = (value, query) => {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true

  const normalizedValue = normalizeSearchText(value)
  if (normalizedValue.includes(normalizedQuery)) return true

  const queryDigits = normalizeSearchDigits(normalizedQuery)
  if (queryDigits.length < 3) return false

  return normalizeSearchDigits(value).includes(queryDigits)
}

export const anyFieldMatchesSearch = (query, fields) => {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true
  return fields.some((field) => fieldMatchesSearch(field, normalizedQuery))
}
