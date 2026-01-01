import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="space-y-2">
        <p className="text-sm text-zinc-600">
          A mobile-first portfolio tracker. Add your trades once — we’ll track positions, live prices, and P&amp;L.
        </p>
      </section>

      {/* Primary actions */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/trades"
          className="rounded-2xl border border-zinc-200 bg-white p-5 hover:bg-zinc-50"
        >
          <div className="space-y-2">
            <div className="text-base font-semibold text-zinc-900">Add trades</div>
            <div className="text-sm text-zinc-600">
              Log buys and sells across stocks, ETFs, crypto, and index funds.
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard"
          className="rounded-2xl border border-zinc-200 bg-white p-5 hover:bg-zinc-50"
        >
          <div className="space-y-2">
            <div className="text-base font-semibold text-zinc-900">View dashboard</div>
            <div className="text-sm text-zinc-600">
              See current value, invested amount, and unrealized P&amp;L — optimized for mobile.
            </div>
          </div>
        </Link>
      </section>

      {/* Secondary action */}
      <section>
        <Link
          href="/settings"
          className="block rounded-2xl border border-zinc-200 bg-white p-5 hover:bg-zinc-50"
        >
          <div className="space-y-2">
            <div className="text-base font-semibold text-zinc-900">Settings</div>
            <div className="text-sm text-zinc-600">
              Manage defaults, currencies, and future import options.
            </div>
          </div>
        </Link>
      </section>

      {/* Status / credibility */}
      <section className="rounded-2xl bg-zinc-50 p-5">
        <div className="text-sm font-semibold text-zinc-900">What&apos;s live</div>
        <ul className="mt-3 space-y-1 text-sm text-zinc-700">
          <li>✓ Trade-based portfolio model</li>
          <li>✓ Live prices for stocks, ETFs, and crypto</li>
          <li>✓ Real-time unrealized P&amp;L</li>
          <li>✓ Mobile-first dashboard (iOS Safari friendly)</li>
        </ul>
      </section>
    </div>
  );
}
