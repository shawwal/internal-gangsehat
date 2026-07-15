'use client'

import { Check } from 'lucide-react'
import { STEP_LABELS } from './types'

interface Props {
  currentStep: number       // 0-indexed
  furthestStep: number      // highest step index reached — only these are click-to-jump
  onJump: (step: number) => void
}

export function StepProgress({ currentStep, furthestStep, onJump }: Props) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEP_LABELS.map((label, i) => {
        const isCurrent  = i === currentStep
        const isDone     = i < currentStep
        const isReachable = i <= furthestStep

        return (
          <div key={label} className="flex items-center shrink-0">
            <button
              type="button"
              disabled={!isReachable}
              onClick={() => isReachable && onJump(i)}
              className={[
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : isDone
                    ? 'bg-primary/10 text-primary hover:bg-primary/15 cursor-pointer'
                    : isReachable
                      ? 'text-muted-foreground hover:bg-muted cursor-pointer'
                      : 'text-muted-foreground/40 cursor-not-allowed',
              ].join(' ')}
            >
              <span
                className={[
                  'flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold shrink-0',
                  isCurrent ? 'bg-primary-foreground/20' : isDone ? 'bg-primary/20' : 'bg-muted',
                ].join(' ')}
              >
                {isDone ? <Check size={10} /> : i + 1}
              </span>
              <span className="whitespace-nowrap hidden sm:inline">{label}</span>
            </button>
            {i < STEP_LABELS.length - 1 && (
              <div className={`w-3 h-px shrink-0 ${isDone ? 'bg-primary/30' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
