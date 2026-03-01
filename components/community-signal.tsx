"use client"

import { useQuery } from "convex/react"
import { api } from "../convex/_generated/api"

function SignalBar({
  label,
  display,
  color,
  pct,
}: {
  label: string
  display: string
  color: string
  pct: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-gripe-muted">{label}</span>
        <span className="font-mono text-[11px] font-bold text-gripe-yellow">{display}</span>
      </div>
      <div className="h-1 w-full bg-gripe-border">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function CommunitySignal() {
  const stats = useQuery(api.pipeline.getStats)
  const items = useQuery(api.pipeline.getAll)

  const bugs = stats?.bugs || 0
  const features = stats?.features || 0
  const total = bugs + features || 1

  const bars = [
    {
      label: "Bug reports",
      display: String(bugs),
      color: "bg-gripe-accent",
      pct: (bugs / total) * 100,
    },
    {
      label: "Feature reqs",
      display: String(features),
      color: "bg-gripe-green",
      pct: (features / total) * 100,
    },
  ]

  // Find the top item by upvotes
  const topItem = items?.length
    ? [...items].sort((a, b) => b.upvotes - a.upvotes)[0]
    : null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-gripe-muted">
        Community Signal
      </h2>

      {/* Bar chart */}
      <div className="flex flex-col gap-3">
        {bars.map((bar) => (
          <SignalBar key={bar.label} {...bar} />
        ))}
      </div>

      {/* Top cluster */}
      <div className="border-t border-gripe-border pt-4">
        <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gripe-muted">
          Top Cluster
        </h3>
        {topItem ? (
          <div className="flex flex-col gap-2">
            <p className="font-[family-name:var(--font-heading)] text-sm font-semibold text-gripe-text">
              {topItem.title}
            </p>
            <span className="font-[family-name:var(--font-heading)] text-3xl font-extrabold text-gripe-yellow">
              {topItem.upvotes}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-gripe-muted">
              Upvotes
            </span>
            {topItem.topComments.length > 0 && (
              <div className="flex flex-col gap-1 pt-1">
                {topItem.topComments.slice(0, 2).map((comment, i) => (
                  <p
                    key={i}
                    className="truncate font-mono text-[11px] italic text-gripe-muted"
                  >
                    {`"${comment}"`}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="font-mono text-[11px] text-gripe-muted">
            No data yet.
          </p>
        )}
      </div>
    </section>
  )
}
