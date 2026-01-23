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
      title="Help & AI Assistant - Learn how to use MARS"
      className="fixed bottom-6 right-6 z-50"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5 }}
      aria-label="Open help"
    >
      <Image
        src="/drop-white.png"
        alt="Help"
        width={48}
        height={48}
        className="drop-shadow-lg"
      />
    </motion.button>
  );
}
