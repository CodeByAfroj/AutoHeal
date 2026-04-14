import { motion } from 'framer-motion';

const statusConfig = {
  ci_failed: {
    label: 'CI Failed',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
    pulse: true
  },
  logs_processed: {
    label: 'Analyzing Crash Logs',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    pulse: true
  },
  ai_running: {
    label: 'AI Generating Patch...',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    dot: 'bg-purple-400',
    pulse: true
  },
  ai_complete: {
    label: 'Validating Fix (Waiting for CI)...',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-400',
    pulse: true
  },
  pr_created: {
    label: 'PR Created',
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    dot: 'bg-cyan-400',
    pulse: false
  },
  awaiting_approval: {
    label: 'Awaiting Approval',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    pulse: true
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    dot: 'bg-green-400',
    pulse: false
  },
  merged: {
    label: 'Merged',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    dot: 'bg-green-400',
    pulse: false
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    dot: 'bg-gray-400',
    pulse: false
  },
  error: {
    label: 'Error',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
    pulse: false
  }
};

export default function StatusBadge({ status, size = 'sm' }) {
  const config = statusConfig[status] || statusConfig.error;
  const sizeClasses = size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-3 py-1 text-xs';

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`status-badge border ${config.color} ${sizeClasses}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot} ${config.pulse ? 'pulse-dot' : ''}`} />
      {config.label}
    </motion.span>
  );
}

export { statusConfig };
