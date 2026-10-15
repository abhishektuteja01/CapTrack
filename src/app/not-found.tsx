import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-4">
      <p className="num text-2xs text-ink-3">404</p>
      <h1 className="text-base font-semibold">This page doesn&apos;t exist</h1>
      <p className="text-[13px] text-ink-2">The link may be old, or the trade was deleted.</p>
      <Link href="/dashboard" className="mt-2 text-[13px] text-accent hover:underline">
        Go to your overview
      </Link>
    </main>
  );
}
