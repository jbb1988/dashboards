import React from 'react';

export interface DataSourceStatusProps {
  name: string;
  status: 'live' | 'manual';
  color: string;
  variant?: 'sidebar' | 'popover';
}

export function DataSourceStatus({ name, status, color, variant = 'popover' }: DataSourceStatusProps) {
  const isPopover = variant === 'popover';

  return (
    <div className={`flex items-center justify-between ${isPopover ? 'py-2' : 'py-1.5'}`}>
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className={`${isPopover ? 'text-[11px]' : 'text-[10px]'} text-[#8FA3BF]`}>
          {name}
        </span>
      </div>
      <span
        className={`${isPopover ? 'text-[10px]' : 'text-[9px]'} ${
          status === 'live' ? 'text-[#22C55E]' : 'text-[#8FA3BF]'
        }`}
      >
        {status === 'live' ? 'Live' : 'Manual'}
      </span>
    </div>
  );
}
