"use client"

import { useEffect, useState } from "react"

function LiveIndicator() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-pulse-live absolute inline-flex h-full w-full rounded-full bg-gripe-green" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-gripe-green" />
      </span>
      <span className="font-mono text-[11px] uppercase tracking-wider text-gripe-green">
        Live
      </span>
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState("")

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      )
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-gripe-muted">
        Last run
      </span>
      <span className="font-mono text-xs text-gripe-text">{time}</span>
    </div>
  )
}

interface StatBlockProps {
  value: string
  label: string
}

function StatBlock({ value, label }: StatBlockProps) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 lg:px-10">
      <span className="font-[family-name:var(--font-heading)] text-3xl font-extrabold text-gripe-yellow lg:text-5xl">
        {value}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gripe-muted">
        {label}
      </span>
    </div>
  )
}

export function TopBar() {
  return (
    <header className="flex items-center justify-between border-b border-gripe-border px-4 py-4 lg:px-6">
      {/* Left: Logo */}
      <div className="flex flex-col gap-0.5">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-tight text-gripe-accent lg:text-4xl">
          {"GRIPE\u2122"}
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gripe-muted">
          Autonomous Product Intelligence
        </span>
      </div>

      {/* Center: Stats */}
      <div className="hidden items-center divide-x divide-gripe-border md:flex">
        <StatBlock value="6" label="Items Shipped" />
        <StatBlock value="24" label="Users Acquired" />
        <StatBlock value="$140" label="Ad Spend" />
      </div>

      {/* Right: Live + Clock */}
      <div className="flex items-center gap-4">
        <LiveIndicator />
        <Clock />
      </div>
    </header>
  )
}
