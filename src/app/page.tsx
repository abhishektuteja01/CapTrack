'use client';

import { motion, Variants } from 'framer-motion';
import { ArrowRight, TrendingUp, ShieldCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white dark:bg-black dark:text-zinc-100 dark:selection:bg-white dark:selection:text-black">
      {/* Background Gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[500px] w-[500px] rounded-full bg-gradient-to-r from-zinc-100 to-zinc-50 blur-3xl dark:from-zinc-900 dark:to-black opacity-60" />
        <div className="absolute -right-[10%] top-[20%] h-[400px] w-[400px] rounded-full bg-gradient-to-l from-zinc-100 to-white blur-3xl dark:from-zinc-900 dark:to-black opacity-50" />
      </div>

      <nav className="relative z-50 mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2"
        >
          <div className="h-8 w-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white font-bold dark:bg-white dark:text-black">
            C
          </div>
          <span className="font-semibold text-lg tracking-tight">CapTrack</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4"
        >
          <Link href="/login" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:text-white">
            Log in
          </Link>
          <Link href="/signup" className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-105 hover:bg-zinc-800 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
            Get Started
          </Link>
        </motion.div>
      </nav>

      <main className="relative z-10 flex flex-col items-center justify-center pt-20 sm:pt-32 pb-20 px-6">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="text-center max-w-3xl mx-auto space-y-8"
        >
          <motion.div variants={fadeInUp} className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white/50 px-3 py-1 text-xs font-medium text-zinc-600 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <span className="mr-2 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
              v1.0 Now Live
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white leading-[1.1]">
              Master Your Portfolio <br className="hidden sm:block" /> with <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-500 to-zinc-900 dark:from-zinc-400 dark:to-white">Precision & Style</span>
            </h1>
            <p className="text-lg text-zinc-600 max-w-2xl mx-auto leading-relaxed dark:text-zinc-400">
              Experience the most intuitive way to track your investments.
              Real-time updates, elegant analytics, and zero clutter.
            </p>
          </motion.div>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/signup" className="group relative overflow-hidden rounded-full bg-zinc-900 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-zinc-800 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
              <span className="relative z-10 flex items-center gap-2">
                Start Tracking Free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
            <Link href="#features" className="rounded-full border border-zinc-200 bg-white px-8 py-3.5 text-sm font-medium text-zinc-900 transition-all hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-black dark:text-white dark:hover:bg-zinc-900">
              View Demo
            </Link>
          </motion.div>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-32 w-full max-w-5xl"
          id="features"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: <TrendingUp className="h-6 w-6 text-zinc-900 dark:text-white" />,
                title: "Real-time Analytics",
                desc: "Live price updates and instant P&L calculations for all your assets."
              },
              {
                icon: <ShieldCheck className="h-6 w-6 text-zinc-900 dark:text-white" />,
                title: "Private by Default",
                desc: "Your data is encrypted and stored locally whenever possible. We don't sell your data."
              },
              {
                icon: <Smartphone className="h-6 w-6 text-zinc-900 dark:text-white" />,
                title: "Mobile First",
                desc: "Designed for your phone. Add to home screen for a native app-like experience."
              }
            ].map((feature, i) => (
              <div key={i} className="group p-6 rounded-2xl border border-zinc-100 bg-white hover:border-zinc-200 hover:shadow-lg transition-all duration-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50 group-hover:bg-zinc-100 transition-colors dark:bg-zinc-800 dark:group-hover:bg-zinc-700">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2 dark:text-white">{feature.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed dark:text-zinc-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <footer className="mt-32 w-full border-t border-zinc-100 pt-8 pb-8 text-center dark:border-zinc-800">
          <p className="text-xs text-zinc-400">
            © {new Date().getFullYear()} CapTrack. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
