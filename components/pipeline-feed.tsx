"use client"

import { useState } from "react"

interface RunCard {
  id: number
  type: "bug" | "feature"
  title: string
  timestamp: string
  pr: string
  verified: boolean
  traceUrl: string
  detail: string
  files: string[]
  isLatest?: boolean
}

const MOCK_RUNS: RunCard[] = [
  {
    id: 1,
    type: "bug",
    title: "Fix checkout crash on empty cart in HelloFresh iOS",
    timestamp: "2m ago",
    pr: "PR #142",
    verified: true,
    traceUrl: "#",
    detail: "$0 spend \u00b7 posted to r/hellofresh",
    files: ["src/cart/CartProvider.tsx", "src/checkout/validate.ts"],
    isLatest: true,
  },
  {
    id: 2,
    type: "feature",
    title: "Add recipe filtering by dietary preference",
    timestamp: "14m ago",
    pr: "PR #141",
    verified: true,
    traceUrl: "#",
    detail: "Campaign live \u00b7 GRIPE10 \u00b7 9 sign-ups",
    files: ["src/recipes/FilterBar.tsx", "src/api/recipes.ts", "src/types/diet.ts"],
  },
  {
    id: 3,
    type: "bug",
    title: "Subscription renewal email sends duplicate",
    timestamp: "38m ago",
    pr: "PR #139",
    verified: false,
    traceUrl: "#",
    detail: "$0 spend \u00b7 posted to r/hellofresh",
    files: ["src/email/scheduler.ts"],
  },
  {
    id: 4,
    type: "feature",
    title: "Weekly meal-prep summary push notification",
    timestamp: "1h ago",
    pr: "PR #137",
    verified: true,
    traceUrl: "#",
    detail: "Campaign live \u00b7 PREP15 \u00b7 4 sign-ups",
    files: ["src/notifications/push.ts", "src/meals/summary.ts"],
  },
  {
    id: 5,
    type: "bug",
    title: "Delivery tracking map renders blank on Android 14",
    timestamp: "2h ago",
    pr: "PR #135",
    verified: true,
    traceUrl: "#",
    detail: "$0 spend \u00b7 posted to r/hellofresh",
    files: ["src/tracking/MapView.tsx", "src/tracking/useLocation.ts"],
  },
  {
    id: 6,
    type: "feature",
    title: "Social sharing for custom recipe creations",
    timestamp: "3h ago",
    pr: "PR #133",
    verified: true,
    traceUrl: "#",
    detail: "Campaign live \u00b7 SHARE20 \u00b7 12 sign-ups",
    files: ["src/social/ShareCard.tsx", "src/api/share.ts"],
  },
  {
    id: 7,
    type: "bug",
    title: "Coupon code GRIPE10 not applying at checkout",
    timestamp: "4h ago",
    pr: "PR #131",
    verified: true,
    traceUrl: "#",
    detail: "$0 spend \u00b7 posted to r/hellofresh",
    files: ["src/checkout/coupon.ts"],
  },
]

function RunCardComponent({ run }: { run: RunCard }) {
  const [expanded, setExpanded] = useState(false)
  const isBug = run.type === "bug"
  const borderColor = isBug ? "border-l-gripe-accent" : "border-l-gripe-green"

  return (
    <div
      className={`group relative cursor-pointer border-l-[3px] ${borderColor} bg-gripe-card transition-all hover:border-t hover:border-t-gripe-accent ${
        run.isLatest ? "shadow-[inset_3px_0_12px_-4px_rgba(255,59,0,0.3)]" : ""
      }`}
      onClick={() => setExpanded(!expanded)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          setExpanded(!expanded)
        }
      }}
    >
      <div className="flex flex-col gap-2 px-4 py-3">
        {/* Top row */}
        <div className="flex items-center gap-3">
          {isBug ? (
            <span className="inline-flex items-center gap-1 rounded-[2px] bg-gripe-accent px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
              BUG
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-[2px] bg-gripe-green px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-gripe-bg">
              FEAT
            </span>
          )}
          <span className="flex-1 truncate font-[family-name:var(--font-heading)] text-sm font-semibold text-gripe-text">
            {run.title}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-gripe-muted">
            {run.timestamp}
          </span>
        </div>

        {/* Middle row */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="#"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[11px] text-gripe-text underline decoration-gripe-muted underline-offset-2 hover:text-gripe-accent"
          >
            {run.pr} {"\u2197"}
          </a>
          {run.verified ? (
            <span className="font-mono text-[11px] text-gripe-green">
              VERIFIED
            </span>
          ) : (
            <span className="font-mono text-[11px] text-gripe-yellow">
              UNVERIFIED
            </span>
          )}
          <a
            href={run.traceUrl}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[11px] text-gripe-muted underline decoration-gripe-muted/50 underline-offset-2 hover:text-gripe-text"
          >
            Laminar trace {"\u2197"}
          </a>
        </div>

        {/* Bottom row */}
        <p className="font-mono text-[11px] text-gripe-muted">{run.detail}</p>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gripe-border px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-gripe-muted">
            Files changed
          </p>
          <ul className="mb-3 flex flex-col gap-1">
            {run.files.map((file) => (
              <li key={file} className="font-mono text-[11px] text-gripe-text">
                {file}
              </li>
            ))}
          </ul>
          <div className="flex h-20 items-center justify-center border border-gripe-border bg-gripe-bg">
            <span className="font-mono text-[10px] uppercase tracking-wider text-gripe-muted">
              Verification Screenshot
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function PipelineFeed() {
  return (
    <section className="flex flex-col gap-0">
      <h2 className="px-4 pb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gripe-muted">
        Pipeline Feed
      </h2>
      <div className="relative flex flex-col gap-px">
        {MOCK_RUNS.map((run) => (
          <RunCardComponent key={run.id} run={run} />
        ))}
        {/* Fade at bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gripe-bg to-transparent" />
      </div>
    </section>
  )
}
