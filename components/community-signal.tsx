const SIGNAL_BARS = [
  { label: "Bug reports", value: 1200, display: "1.2k", color: "bg-gripe-accent", pct: 100 },
  { label: "Feature reqs", value: 840, display: "840", color: "bg-gripe-green", pct: 70 },
  { label: "X mentions", value: 510, display: "510", color: "bg-gripe-accent", pct: 42.5 },
]

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
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-gripe-muted">
        Community Signal
      </h2>

      {/* Bar chart */}
      <div className="flex flex-col gap-3">
        {SIGNAL_BARS.map((bar) => (
          <SignalBar key={bar.label} {...bar} />
        ))}
      </div>

      {/* Top cluster */}
      <div className="border-t border-gripe-border pt-4">
        <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gripe-muted">
          Top Cluster
        </h3>
        <div className="flex flex-col gap-2">
          <p className="font-[family-name:var(--font-heading)] text-sm font-semibold text-gripe-text">
            Checkout flow breaks on coupon apply
          </p>
          <span className="font-[family-name:var(--font-heading)] text-3xl font-extrabold text-gripe-yellow">
            247
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-gripe-muted">
            Upvotes
          </span>
          <div className="flex flex-col gap-1 pt-1">
            <p className="truncate font-mono text-[11px] italic text-gripe-muted">
              {'"Every time I apply GRIPE10 the cart just empties..."'}
            </p>
            <p className="truncate font-mono text-[11px] italic text-gripe-muted">
              {'"Coupon field throws 500 on mobile checkout"'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
