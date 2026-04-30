import { motion } from 'framer-motion';

const statusConfig = {
  ci_failed: {
    label: 'CI Failed',
    shortLabel: 'Failed',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
    pulse: true
  },
  logs_processed: {
    label: 'Analyzing Crash Logs',
    shortLabel: 'Analyzing',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    pulse: true
  },
  ai_running: {
    label: 'AI Generating Patch...',
    shortLabel: 'AI Running',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    dot: 'bg-purple-400',
    pulse: true
  },
  ai_complete: {
    label: 'Validating Fix...',
    shortLabel: 'Validating',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-400',
    pulse: true
  },
  pr_created: {
    label: 'PR Created',
    shortLabel: 'PR Created',
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    dot: 'bg-cyan-400',
    pulse: false
  },
  awaiting_approval: {
    label: 'Awaiting Approval',
    shortLabel: 'Approval',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    pulse: true
  },
  approved: {
    label: 'Approved',
    shortLabel: 'Approved',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    dot: 'bg-green-400',
    pulse: false
  },
  merged: {
    label: 'Merged',
    shortLabel: 'Merged',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    dot: 'bg-green-400',
    pulse: false
  },
  rejected: {
    label: 'Rejected',
    shortLabel: 'Rejected',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    dot: 'bg-gray-400',
    pulse: false
  },
  error: {
    label: 'Error',
    shortLabel: 'Error',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
    pulse: false
  }
};

export default function StatusBadge({ status, size = 'sm' }) {
  const config = statusConfig[status] || statusConfig.error;
  const sizeClasses = size === 'lg' ? 'px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-sm' : 'px-2 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-xs';

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`status-badge border whitespace-nowrap ${config.color} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${config.dot} ${config.pulse ? 'pulse-dot' : ''}`} />
      <span className="hidden sm:inline">{config.label}</span>
      <span className="sm:hidden">{config.shortLabel}</span>
    </motion.span>
  );
}

export { statusConfig };
