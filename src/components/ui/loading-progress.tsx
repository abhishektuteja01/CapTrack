'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export function LoadingProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Use a small delay/microtask to avoid synchronous setState in effect (Next.js/React best practice)
    const animationStart = requestAnimationFrame(() => setLoading(true));
    const timeout = setTimeout(() => setLoading(false), 500);
    return () => {
      cancelAnimationFrame(animationStart);
      clearTimeout(timeout);
    };
  }, [pathname, searchParams]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed top-0 left-0 right-0 z-[100] h-[3px] origin-left bg-zinc-900"
          style={{
            background: 'linear-gradient(90deg, #3b82f6 0%, #a5b4fc 50%, #60a5fa 100%)',
            boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
          }}
        />
      )}
    </AnimatePresence>
  );
}
