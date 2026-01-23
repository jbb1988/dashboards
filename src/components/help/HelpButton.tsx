'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface HelpButtonProps {
  onClick: () => void;
}

export default function HelpButton({ onClick }: HelpButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#38BDF8] hover:bg-[#0EA5E9] text-white shadow-lg shadow-[#38BDF8]/25 flex items-center justify-center transition-colors"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5 }}
      aria-label="Open help"
    >
      <Image
        src="/drop-white.png"
        alt="Help"
        width={24}
        height={24}
        className="drop-shadow-sm"
      />
    </motion.button>
  );
}
