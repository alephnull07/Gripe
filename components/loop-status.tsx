"use client"

import { useQuery } from "convex/react"
import { api } from "../convex/_generated/api"

function StatusDot({ status }: { status: string }) {
  if (status === "done") {
    return <span className="inline-block h-2 w-2 rounded-full bg-gripe-green" />
  }
  if (status === "running") {
    return <span className="animate-pulse-step inline-block h-2 w-2 rounded-full bg-gripe-yellow" />
  }
  return <span className="inline-block h-2 w-2 rounded-full bg-gripe-muted/40" />
}

export function LoopStatus() {
  const currentRun = useQuery(api.runs.getCurrent)
  const isRunning = currentRun?.status === "running"
  const isStale = currentRun?.status === "stale"
  const isIdle = !currentRun || currentRun.status === "idle" || currentRun.status === "completed"
  // When idle or completed, show all steps as pending (not green from last run)
  const steps = isIdle
    ? (currentRun?.steps || []).map((s: { name: string; status: string }) => ({ ...s, status: "pending" }))
    : currentRun?.steps || []

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-gripe-muted">
        Loop Status
      </h2>

      {isStale && (
        <div className="rounded border border-gripe-accent/30 bg-gripe-accent/10 px-3 py-2">
          <p className="font-mono text-[11px] text-gripe-accent">
            Previous run timed out. You can start a new one.
          </p>
        </div>
      )}

      {/* Steps */}
      <div className="flex flex-col gap-0">
        {steps.map((step, i) => (
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
                  ? isStale ? "text-gripe-accent/60" : "text-gripe-yellow"
                  : "text-gripe-text"
              }`}
            >
              {step.name}
            </span>
            <StatusDot status={isStale && step.status === "running" ? "stale" : step.status} />
          </div>
        ))}
      </div>

      {/* Run Now Button */}
      <div className="border-t border-gripe-border pt-4">
        <button
          onClick={async () => {
            await fetch("/api/trigger-pipeline", { method: "POST" })
          }}
          disabled={isRunning}
          className={`w-full py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all ${
            isRunning
              ? "animate-pulse bg-gripe-yellow/20 text-gripe-yellow cursor-not-allowed"
              : "bg-gripe-accent text-white hover:bg-gripe-accent/80 cursor-pointer"
          }`}
        >
          {isRunning ? "\u27F3 Pipeline Running..." : "\u25B6 Run Now"}
        </button>
        {!isRunning && (
          <>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gripe-muted">
              Next Scheduled Run
            </p>
            <p className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-gripe-muted">
              Tonight 11:59 PM
            </p>
          </>
        )}
      </div>
    </section>
  )
}
