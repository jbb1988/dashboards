'use client';

import { motion } from 'framer-motion';

interface PillarStats {
  total: number;
  onTrack: number;
  atRisk: number;
  critical: number;
  complete: number;
  avgProgress: number;
}

interface PillarGaugesProps {
  data: Record<string, PillarStats>;
  pillarColors: Record<string, string>;
}

// Animated circular gauge component
function CircularGauge({
  value,
  color,
  label,
  subtitle,
  delay = 0,
}: {
  value: number;
  color: string;
  label: string;
  subtitle: string;
  delay?: number;
}) {
  const radius = 45;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      className="flex flex-col items-center"
    >
      <div className="relative">
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <motion.circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.5, delay: delay + 0.2, ease: 'easeOut' }}
            transform="rotate(-90 60 60)"
            style={{
              filter: `drop-shadow(0 0 8px ${color}40)`,
            }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.5 }}
            className="text-2xl font-bold text-white"
          >
            {value}%
          </motion.span>
        </div>
      </div>
      <div className="mt-3 text-center">
        <p className="text-white font-medium text-[13px]">{label}</p>
        <p className="text-[#64748B] text-[11px]">{subtitle}</p>
      </div>
    </motion.div>
  );
}

// Pillar name shortener
function shortenPillar(name: string): string {
  const mapping: Record<string, string> = {
    'REVENUE GROWTH': 'Revenue',
    'OPERATING RESULTS': 'Operating',
    'CUSTOMER SATISFACTION': 'Customer',
    'TEAM MEMBER SATISFACTION': 'Team',
  };
  return mapping[name] || name;
}

export default function PillarGauges({ data, pillarColors }: PillarGaugesProps) {
  const pillars = Object.entries(data);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-full flex items-center justify-around py-4"
    >
      {pillars.map(([pillar, stats], index) => (
        <CircularGauge
          key={pillar}
          value={Math.round(stats.avgProgress)}
          color={pillarColors[pillar] || '#64748B'}
          label={shortenPillar(pillar)}
          subtitle={`${stats.total} initiatives`}
          delay={index * 0.15}
        />
      ))}
    </motion.div>
  );
}
