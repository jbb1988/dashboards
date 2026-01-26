'use client';

import { motion } from 'framer-motion';

interface AlertBadgeProps {
  count: number;
  type?: 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  pulse?: boolean;
}

const badgeColors = {
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
};

export function AlertBadge({
  count,
  type = 'error',
  size = 'sm',
  pulse = true,
}: AlertBadgeProps) {
  if (count <= 0) return null;

  const sizeClasses = size === 'sm'
    ? 'w-4 h-4 text-[9px]'
    : 'w-5 h-5 text-[10px]';

  const displayCount = count > 99 ? '99+' : count > 9 ? '9+' : count;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="relative"
    >
      <div
        className={`${sizeClasses} ${badgeColors[type]} rounded-full flex items-center justify-center font-bold text-white`}
      >
        {displayCount}
      </div>
      {pulse && (
        <motion.div
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: 'loop',
          }}
          className={`absolute inset-0 ${badgeColors[type]} rounded-full`}
        />
      )}
    </motion.div>
  );
}

export default AlertBadge;
