'use client'

import { DragEvent, useMemo, useState } from 'react'
import { DEAL_PIPELINE_STAGES, type DealStage, type DealWithRelations } from '@/lib/types'
import { formatCurrency } from '@/lib/format'
import DealCard from './DealCard'

interface DealKanbanProps {
  deals: DealWithRelations[]
  onMove: (dealId: string, stage: DealStage) => void
  onSelect: (deal: DealWithRelations) => void
}

export default function DealKanban({ deals, onMove, onSelect }: DealKanbanProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const byStage = useMemo(() => {
    const grouped = new Map<DealStage, DealWithRelations[]>()
    DEAL_PIPELINE_STAGES.forEach((stage) => grouped.set(stage, []))
    for (const deal of deals) {
      if (grouped.has(deal.stage)) grouped.get(deal.stage)!.push(deal)
    }
    return grouped
  }, [deals])

  function handleDrop(event: DragEvent<HTMLDivElement>, stage: DealStage) {
    event.preventDefault()
    const dealId = event.dataTransfer.getData('text/plain')
    setDraggedId(null)
    if (dealId) onMove(dealId, stage)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {DEAL_PIPELINE_STAGES.map((stage) => {
        const columnDeals = byStage.get(stage) ?? []
        const total = columnDeals.reduce((sum, d) => sum + (d.value_amount ?? 0), 0)

        return (
          <div
            key={stage}
            onDrop={(event) => handleDrop(event, stage)}
            onDragOver={handleDragOver}
            className="flex min-h-[28rem] w-[19rem] min-w-[19rem] flex-shrink-0 flex-col rounded-3xl border border-[#2A2A3A] bg-[#1A1A28] p-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#2A2A3A] pb-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
                  {stage}
                </h2>
                <p className="mt-1 text-sm font-semibold text-white">
                  {formatCurrency(total, 'GBP')}
                </p>
              </div>
              <span className="rounded-full border border-[#2A2A3A] bg-[#0C0C14] px-2.5 py-1 text-xs text-[#9CA3AF]">
                {columnDeals.length}
              </span>
            </div>

            <div className="mt-4 flex flex-1 flex-col gap-3">
              {columnDeals.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[#2A2A3A] bg-[#13131E] px-4 text-center text-sm text-[#6B7280]">
                  Drop a deal here
                </div>
              ) : (
                columnDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', deal.id)
                      event.dataTransfer.effectAllowed = 'move'
                      setDraggedId(deal.id)
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    className={`cursor-grab active:cursor-grabbing ${
                      draggedId === deal.id ? 'opacity-60' : ''
                    }`}
                  >
                    <DealCard deal={deal} onClick={() => onSelect(deal)} />
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
