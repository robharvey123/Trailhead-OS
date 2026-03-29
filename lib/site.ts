export function isLocalDevelopmentHost(hostname: string) {
  return hostname.includes('localhost') || hostname.includes('127.0.0.1')
}

export function buildMarketingHref(path: string, isLocalhost: boolean) {
  const [pathWithQuery, hash = ''] = path.split('#')
  const [pathname, query = ''] = pathWithQuery.split('?')
  const params = new URLSearchParams(query)

  if (isLocalhost) {
    params.set('site', 'marketing')
  }

  const search = params.toString()

  return `${pathname}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`
}

export function buildMarketingSiteUrl(path: string, isLocalhost: boolean) {
  if (isLocalhost) {
    return buildMarketingHref(path, true)
  }

  return `https://trailheadholdings.uk${path}`
}

export function buildAppLoginHref(isLocalhost: boolean) {
  return isLocalhost
    ? '/login?site=app'
    : 'https://app.trailheadholdings.uk/login'
}
