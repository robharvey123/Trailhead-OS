'use client'

import dynamic from 'next/dynamic'
import ChartSkeleton from '@/components/charts/ChartSkeleton'

/** Recharts boundary for the company summary page — see dashboard/charts-lazy.tsx. */

export const CompanyCharts = dynamic(() => import('./CompanyCharts'), {
  ssr: false,
  loading: () => <ChartSkeleton tall />,
})

export const CompanyMonthlyCharts = dynamic(() => import('./CompanyMonthlyCharts'), {
  ssr: false,
  loading: () => <ChartSkeleton tall />,
})
