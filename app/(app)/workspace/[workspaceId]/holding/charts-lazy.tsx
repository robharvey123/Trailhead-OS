'use client'

import dynamic from 'next/dynamic'
import ChartSkeleton from '@/components/charts/ChartSkeleton'

/**
 * Recharts boundary for the holding dashboard. The component fetches its own
 * data in an effect and is client-only already, so `ssr: false` changes nothing
 * about what the user sees — it just keeps Recharts out of the page's first load.
 */
export const HoldingDashboard = dynamic(() => import('./HoldingDashboard'), {
  ssr: false,
  loading: () => <ChartSkeleton cards={2} />,
})
