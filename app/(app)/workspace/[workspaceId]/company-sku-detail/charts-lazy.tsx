'use client'

import dynamic from 'next/dynamic'
import ChartSkeleton from '@/components/charts/ChartSkeleton'

/** Recharts boundary for the company/SKU detail page — see dashboard/charts-lazy.tsx. */

export const CompanySkuCharts = dynamic(() => import('./CompanySkuCharts'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
})
