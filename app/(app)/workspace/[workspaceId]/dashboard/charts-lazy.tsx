'use client'

import dynamic from 'next/dynamic'
import ChartSkeleton from '@/components/charts/ChartSkeleton'

/**
 * Client boundary that keeps Recharts out of the initial bundle for every page
 * that shows the workspace dashboard charts (`dashboard/page.tsx`,
 * `insights/InsightsClient.tsx`, the public `report/[token]` page).
 *
 * `ssr: false` because all three components are pure Recharts —
 * `ResponsiveContainer` measures the DOM, so the server pass renders an empty
 * box regardless. Skipping it costs nothing and drops the library from the
 * server render too.
 */

export const DashboardCharts = dynamic(() => import('./DashboardCharts'), {
  ssr: false,
  loading: () => <ChartSkeleton cards={2} />,
})

export const DashboardInsights = dynamic(() => import('./DashboardInsights'), {
  ssr: false,
  loading: () => <ChartSkeleton cards={4} />,
})

export const DashboardSkuInsights = dynamic(() => import('./DashboardSkuInsights'), {
  ssr: false,
  loading: () => <ChartSkeleton cards={2} />,
})
