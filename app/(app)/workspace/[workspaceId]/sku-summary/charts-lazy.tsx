'use client'

import dynamic from 'next/dynamic'
import ChartSkeleton from '@/components/charts/ChartSkeleton'

/** Recharts boundary for the SKU summary page — see dashboard/charts-lazy.tsx. */

export const SkuCharts = dynamic(() => import('./SkuCharts'), {
  ssr: false,
  loading: () => <ChartSkeleton cards={2} />,
})
