import { TopBar } from "@/components/top-bar"
import { PipelineFeed } from "@/components/pipeline-feed"
import { CommunitySignal } from "@/components/community-signal"
import { LoopStatus } from "@/components/loop-status"
import { ActiveThreads } from "@/components/active-threads"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gripe-bg">
      <TopBar />

      {/* Main 3-column grid */}
      <main className="flex-1 px-4 py-4 lg:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px_280px] xl:grid-cols-[1fr_300px_300px]">
          {/* Column 1: Pipeline Feed (widest) */}
          <div className="min-h-0 overflow-hidden">
            <PipelineFeed />
          </div>

          {/* Column 2: Community Signal */}
          <div className="border-gripe-border lg:border-l lg:pl-4">
            <CommunitySignal />
          </div>

          {/* Column 3: Loop Status */}
          <div className="border-gripe-border lg:border-l lg:pl-4">
            <LoopStatus />
          </div>
        </div>

        {/* Bottom: Active Threads */}
        <div className="mt-4 border-t border-gripe-border pt-4">
          <ActiveThreads />
        </div>
      </main>
    </div>
  )
}
