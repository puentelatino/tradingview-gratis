"use client";

import { Watchlist } from "@/components/watchlist/Watchlist";

export function RightSidebar() {
  return (
    <aside className="hidden w-64 flex-col border-l border-tv-border bg-tv-panel md:flex">
      <Watchlist />
    </aside>
  );
}
