export const chunkArray = <T>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export const getDateRange = (dates: string[]) => {
  if (!dates.length) {
    return null
  }

  let min = dates[0]
  let max = dates[0]

  dates.forEach((date) => {
    if (date < min) {
      min = date
    }
    if (date > max) {
      max = date
    }
  })

  return { min, max }
}
