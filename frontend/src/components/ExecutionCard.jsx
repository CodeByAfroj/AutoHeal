import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { GitCommit, Clock, FolderGit2 } from 'lucide-react';

export default function ExecutionCard({ execution, index = 0 }) {
  const navigate = useNavigate();

  const timeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => navigate(`/pipelines/${execution._id}`)}
      className="glass-card-hover p-5 cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-navy-700/80 flex items-center justify-center
            group-hover:bg-heal-cyan/10 transition-colors">
            <FolderGit2 className="w-4 h-4 text-gray-400 group-hover:text-heal-cyan transition-colors" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
              {execution.repoFullName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <GitCommit className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-500 font-mono">
                {execution.commitSha?.substring(0, 7) || 'unknown'}
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-xs text-gray-500">{execution.branch}</span>
            </div>
          </div>
        </div>

        <StatusBadge status={execution.status} />
      </div>

      {execution.errorMessage && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 pl-12">
          {execution.errorMessage}
        </p>
      )}

      <div className="flex items-center justify-between pl-12">
        <div className="flex items-center gap-1.5 text-gray-500">
          <Clock className="w-3 h-3" />
          <span className="text-xs">{timeAgo(execution.createdAt)}</span>
        </div>

        {execution.prUrl && (
          <a
            href={execution.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-heal-cyan hover:text-heal-cyan/80 transition-colors"
          >
            PR #{execution.prNumber}
          </a>
        )}
      </div>
    </motion.div>
  );
}
