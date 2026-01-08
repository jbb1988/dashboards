'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0F1722] text-white flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center justify-center mb-4">
            <img
              src="/mars-logo-horizontal.png"
              alt="MARS"
              className="h-14 object-contain"
            />
          </div>
          <p className="text-[#8FA3BF]">Business Intelligence Platform</p>
        </motion.div>

        <Link href="/contracts-dashboard">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full px-8 py-4 rounded-xl bg-gradient-to-r from-[#0189CB] to-[#38BDF8] text-white font-semibold text-lg shadow-lg shadow-[#0189CB]/25 hover:shadow-[#0189CB]/40 transition-all"
          >
            MARS Executive Dashboards
          </motion.button>
        </Link>
      </div>
    </div>
  );
}
