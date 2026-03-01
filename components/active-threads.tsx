const THREADS = [
  {
    thread: "reddit.com/r/hellofresh/comments/1abc...",
    type: "bug" as const,
    replies: 23,
    lastActivity: "2m ago",
    status: "WATCHING" as const,
  },
  {
    thread: "reddit.com/r/mealprep/comments/2def...",
    type: "feature" as const,
    replies: 14,
    lastActivity: "8m ago",
    status: "WATCHING" as const,
  },
  {
    thread: "reddit.com/r/hellofresh/comments/3ghi...",
    type: "bug" as const,
    replies: 45,
    lastActivity: "22m ago",
    status: "RESOLVED" as const,
  },
  {
    thread: "reddit.com/r/cooking/comments/4jkl...",
    type: "feature" as const,
    replies: 8,
    lastActivity: "1h ago",
    status: "WATCHING" as const,
  },
  {
    thread: "reddit.com/r/hellofresh/comments/5mno...",
    type: "bug" as const,
    replies: 31,
    lastActivity: "2h ago",
    status: "RESOLVED" as const,
  },
  {
    thread: "reddit.com/r/startups/comments/6pqr...",
    type: "feature" as const,
    replies: 19,
    lastActivity: "3h ago",
    status: "RESOLVED" as const,
  },
]

export function ActiveThreads() {
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
            {THREADS.map((t, i) => (
              <tr
                key={t.thread}
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
