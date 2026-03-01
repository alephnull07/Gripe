"use client"

import { useQuery } from "convex/react"
import { api } from "../convex/_generated/api"

function getTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function ActiveThreads() {
  const items = useQuery(api.pipeline.getAll)

  const threads =
    items?.map((item) => ({
      thread: item.url,
      type: (item.type === "bug" ? "bug" : "feature") as "bug" | "feature",
      replies: item.topComments?.length || 0,
      lastActivity: getTimeAgo(item.updatedAt),
      status: (item.status === "done" ? "RESOLVED" : "WATCHING") as
        | "RESOLVED"
        | "WATCHING",
    })) || []

  return (
    <section className="flex flex-col gap-0">
      <h2 className="px-4 pb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gripe-muted">
        Active Threads
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-gripe-border">
              <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-gripe-muted">
                Thread
              </th>
              <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-gripe-muted">
                Type
              </th>
              <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-gripe-muted">
                Replies
              </th>
              <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-gripe-muted">
                Last Activity
              </th>
              <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-gripe-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {threads.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center font-mono text-[11px] text-gripe-muted"
                >
                  No active threads yet.
                </td>
              </tr>
            )}
            {threads.map((t, i) => (
              <tr
                key={t.thread + i}
                className={`border-b border-gripe-border/50 ${
                  i % 2 === 0 ? "bg-gripe-card-alt" : "bg-gripe-card"
                }`}
              >
                <td className="truncate px-4 py-2.5 font-mono text-[11px] text-gripe-text">
                  {t.thread}
                </td>
                <td className="px-4 py-2.5">
                  {t.type === "bug" ? (
                    <span className="inline-flex rounded-[2px] bg-gripe-accent px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                      BUG
                    </span>
                  ) : (
                    <span className="inline-flex rounded-[2px] bg-gripe-green px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-gripe-bg">
                      FEAT
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[11px] text-gripe-text">
                  {t.replies}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[11px] text-gripe-muted">
                  {t.lastActivity}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span
                    className={`font-mono text-[11px] font-bold uppercase tracking-wider ${
                      t.status === "WATCHING"
                        ? "text-gripe-yellow"
                        : "text-gripe-green"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
