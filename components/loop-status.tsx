"use client"

import { useEffect, useState } from "react"

const STEPS = [
  { name: "SCRAPE", status: "done" as const },
  { name: "CLASSIFY", status: "done" as const },
  { name: "BUILD", status: "done" as const },
  { name: "VERIFY", status: "running" as const },
  { name: "OUTPUT", status: "pending" as const },
  { name: "BRIEF", status: "pending" as const },
  { name: "LISTEN", status: "pending" as const },
]

function StatusDot({ status }: { status: "done" | "running" | "pending" }) {
  if (status === "done") {
    return <span className="inline-block h-2 w-2 rounded-full bg-gripe-green" />
  }
  if (status === "running") {
    return <span className="animate-pulse-step inline-block h-2 w-2 rounded-full bg-gripe-yellow" />
  }
  return <span className="inline-block h-2 w-2 rounded-full bg-gripe-muted/40" />
}

export function LoopStatus() {
  const [countdown, setCountdown] = useState(127)

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 0 ? 180 : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60
  const progress = ((180 - countdown) / 180) * 100

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-gripe-muted">
        Loop Status
      </h2>

      {/* Steps */}
      <div className="flex flex-col gap-0">
        {STEPS.map((step, i) => (
          <div
            key={step.name}
            className="flex items-center gap-3 border-b border-gripe-border/50 py-2 last:border-b-0"
          >
            <span className="w-4 font-mono text-[11px] font-bold text-gripe-accent">
              {i + 1}
            </span>
            <span
              className={`flex-1 font-[family-name:var(--font-heading)] text-xs font-semibold uppercase tracking-wider ${
                step.status === "pending"
                  ? "text-gripe-muted/40"
                  : step.status === "running"
                  ? "text-gripe-yellow"
                  : "text-gripe-text"
              }`}
            >
              {step.name}
            </span>
            <StatusDot status={step.status} />
          </div>
        ))}
      </div>

      {/* Countdown */}
      <div className="border-t border-gripe-border pt-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gripe-muted">
          Next Run In
        </p>
        <p className="font-[family-name:var(--font-heading)] text-3xl font-extrabold text-gripe-yellow">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </p>
        <div className="mt-2 h-0.5 w-full bg-gripe-border">
          <div
            className="h-full bg-gripe-yellow transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </section>
  )
}
