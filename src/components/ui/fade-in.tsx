'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.5
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
