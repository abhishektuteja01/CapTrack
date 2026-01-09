import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-black">
      <main className="mx-auto w-full max-w-md px-4 py-10">
        {children}
      </main>
    </div>
  );
}