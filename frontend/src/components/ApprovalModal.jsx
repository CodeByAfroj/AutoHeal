import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertTriangle, GitPullRequest } from 'lucide-react';

export default function ApprovalModal({ isOpen, onClose, onApprove, onReject, execution, loading }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg mx-4 glass-card p-6 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-heal-gradient/20 flex items-center justify-center">
              <GitPullRequest className="w-5 h-5 text-heal-cyan" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Review AI Fix</h3>
              <p className="text-sm text-gray-400">PR #{execution?.prNumber} • {execution?.repoFullName}</p>
            </div>
          </div>

          {/* RCA Info */}
          {execution?.rcaResult?.rootCause && (
            <div className="mb-6 p-4 bg-navy-900/60 rounded-xl border border-white/5">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Root Cause</h4>
              <p className="text-sm text-gray-300">{execution.rcaResult.rootCause}</p>
              {execution.rcaResult.targetFile && (
                <p className="text-xs text-gray-500 mt-2 font-mono">
                  📄 {execution.rcaResult.targetFile}
                </p>
              )}
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-3 mb-6 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-300">
              Approving will <strong>merge this PR</strong> into the base branch.
              Make sure you've reviewed the changes.
            </p>
          </div>

          {/* PR Link */}
          {execution?.prUrl && (
            <a
              href={execution.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mb-6 px-4 py-3 bg-navy-700/50 rounded-lg
                text-heal-cyan hover:bg-navy-700 transition-colors"
            >
              <GitPullRequest className="w-4 h-4" />
              <span className="text-sm">View Pull Request on GitHub</span>
            </a>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onReject}
              disabled={loading}
              className="flex-1 btn-danger flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={onApprove}
              disabled={loading}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Approve & Merge
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
