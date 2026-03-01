"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "../convex/_generated/api"

interface RunCard {
  id: string
  type: "bug" | "feature"
  title: string
  timestamp: string
  pr: string
  verified: boolean
  traceUrl: string
  detail: string
  files: string[]
  isLatest?: boolean
  status?: string
}

function getTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

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
          {run.pr && run.pr !== "Pending" ? (
            <a
              href={run.pr}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-[11px] text-gripe-text underline decoration-gripe-muted underline-offset-2 hover:text-gripe-accent"
            >
              {run.pr.includes("github.com") ? run.pr.replace(/.*github\.com\//, "").replace(/\/pull\//, " #") : run.pr} {"\u2197"}
            </a>
          ) : (
            <span className="font-mono text-[11px] text-gripe-muted">
              {run.status === "detected" || run.status === "building" || run.status === "verifying" ? "PR pending..." : "No PR"}
            </span>
          )}
          {run.verified ? (
            <span className="font-mono text-[11px] text-gripe-green">
              VERIFIED
            </span>
          ) : (
            <span className="font-mono text-[11px] text-gripe-yellow">
              UNVERIFIED
            </span>
          )}
          {run.traceUrl && run.traceUrl !== "#" && (
            <a
              href={run.traceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-[11px] text-gripe-muted underline decoration-gripe-muted/50 underline-offset-2 hover:text-gripe-text"
            >
              Laminar trace {"\u2197"}
            </a>
          )}
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
  const items = useQuery(api.pipeline.getAll)

  const runs: RunCard[] =
    items?.map((item, i) => ({
      id: item._id,
      type: (item.type === "bug" ? "bug" : "feature") as "bug" | "feature",
      title: item.summary || item.title,
      timestamp: getTimeAgo(item.updatedAt),
      pr: item.pr || "Pending",
      verified: item.verified || false,
      traceUrl: item.traceUrl || "",
      detail: item.detail || item.statusMessage || `Status: ${item.status}`,
      files: item.filesChanged || [],
      isLatest: i === 0,
      status: item.status,
    })) || []

  return (
    <section className="flex flex-col gap-0">
      <h2 className="px-4 pb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gripe-muted">
        Pipeline Feed
      </h2>
      <div className="relative flex flex-col gap-px">
        {runs.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="font-mono text-[11px] text-gripe-muted">
              No pipeline items yet. Run the pipeline to see results here.
            </p>
          </div>
        )}
        {runs.map((run) => (
          <RunCardComponent key={run.id} run={run} />
        ))}
        {runs.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gripe-bg to-transparent" />
        )}
      </div>
    </section>
  )
}
