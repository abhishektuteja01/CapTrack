

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-600">
          Preferences and integrations will live here. For now, CapTrack focuses on clean trade entry and correctness.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="text-sm font-medium">Default currency</div>
          <p className="mt-1 text-sm text-zinc-600">
            Coming soon: choose a default currency (USD, INR, etc.) for new trades.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="text-sm font-medium">Price providers</div>
          <p className="mt-1 text-sm text-zinc-600">
            Coming soon: configure stock and crypto data sources and refresh cadence.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4 sm:col-span-2">
          <div className="text-sm font-medium">Imports</div>
          <p className="mt-1 text-sm text-zinc-600">
            Coming soon: import trades from broker apps via CSV or direct integrations.
          </p>
        </div>
      </section>

      <section className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
        <div className="font-medium text-zinc-900">Prototype note</div>
        <p className="mt-1">
          Settings is intentionally minimal in the first prototype. We’ll lock the core data model
          before adding customization and automation.
        </p>
      </section>
    </div>
  );
}