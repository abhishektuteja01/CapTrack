import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">CapTrack</h1>
        <p className="text-sm text-zinc-600">
          Mobile-first portfolio tracking. Enter trades now, then we’ll derive positions and performance.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/trades"
          className="rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50"
        >
          <div className="space-y-1">
            <div className="text-sm font-medium">Add trades</div>
            <div className="text-sm text-zinc-600">
              Manually enter buys/sells (stocks, ETFs, mutual funds, crypto).
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard"
          className="rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50"
        >
          <div className="space-y-1">
            <div className="text-sm font-medium">Dashboard</div>
            <div className="text-sm text-zinc-600">
              View positions and P/L (we’ll wire this up next).
            </div>
          </div>
        </Link>

        <Link
          href="/settings"
          className="rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50 sm:col-span-2"
        >
          <div className="space-y-1">
            <div className="text-sm font-medium">Settings</div>
            <div className="text-sm text-zinc-600">
              Configure currency defaults, data providers, and imports later.
            </div>
          </div>
        </Link>
      </section>

      <section className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
        <div className="font-medium text-zinc-900">Milestone status</div>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Trades: create ✅</li>
          <li>Trades list: next</li>
          <li>Positions + P/L: upcoming</li>
          <li>Live prices + caching: upcoming</li>
        </ul>
      </section>
    </div>
  );
}
