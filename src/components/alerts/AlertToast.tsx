'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, AlertTriangle, Info, X, CheckCircle } from 'lucide-react';

export type AlertType = 'warning' | 'error' | 'info' | 'success';

interface AlertToastProps {
  visible: boolean;
  type: AlertType;
  title: string;
  message?: string;
  onDismiss: () => void;
  autoHide?: boolean;
  autoHideDelay?: number;
}

const alertStyles: Record<AlertType, { bg: string; border: string; text: string; icon: React.ElementType }> = {
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: AlertTriangle,
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: AlertCircle,
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: Info,
  },
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    icon: CheckCircle,
  },
};

export function AlertToast({
  visible,
  type,
  title,
  message,
  onDismiss,
  autoHide = true,
  autoHideDelay = 5000,
}: AlertToastProps) {
  const style = alertStyles[type];
  const Icon = style.icon;

  // Auto-hide effect
  if (autoHide && visible) {
    setTimeout(() => {
      onDismiss();
    }, autoHideDelay);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border backdrop-blur-sm ${style.bg} ${style.border} ${style.text} flex items-start gap-3 max-w-md shadow-lg`}
        >
          <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{title}</p>
            {message && <p className="text-xs opacity-70 mt-0.5">{message}</p>}
          </div>
          <button
            onClick={onDismiss}
            className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AlertToast;
