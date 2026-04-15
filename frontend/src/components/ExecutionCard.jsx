import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { GitCommit, Clock, FolderGit2, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function LiveTimer({ startTime, status }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const isFinished = ['pr_created', 'approved', 'merged', 'rejected', 'error'].includes(status);
    
    const update = () => {
      const start = new Date(startTime);
      const diff = Math.floor((new Date() - start) / 1000);
      
      if (isFinished) {
        // If done, show static time-ago format
        if (diff < 60) setElapsed(`${diff}s ago`);
        else if (diff < 3600) setElapsed(`${Math.floor(diff / 60)}m ago`);
        else if (diff < 86400) setElapsed(`${Math.floor(diff / 3600)}h ago`);
        else setElapsed(`${Math.floor(diff / 86400)}d ago`);
        return;
      }
      
      // If actively running, show a live minute:second stopwatch counter
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsed(`Elapsed: ${m}:${s}`);
    };

    update();
    if (isFinished) return;

    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime, status]);

  return <span>{elapsed}</span>;
}

export default function ExecutionCard({ execution, index = 0 }) {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this execution?')) return;
    
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/api/executions/${execution._id || execution.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Delete failed');
      // The reload will happen naturally via SSE 'execution_updated' 
      // or we can just let the user refresh/switch tabs
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete execution');
      setIsDeleting(false);
    }
  };

  const isFinalStatus = ['pr_created', 'approved', 'merged', 'rejected', 'error'].includes(execution.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => navigate(`/app/pipelines/${execution._id || execution.id}`)}
      className={`glass-card-hover p-5 cursor-pointer group relative overflow-hidden ${isDeleting ? 'opacity-30 pointer-events-none' : ''}`}
    >
      {/* Delete Button (Danger Zone) */}
      <button
        onClick={handleDelete}
        className="absolute top-4 right-14 p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all z-10"
        title="Remove Execution"
      >
        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-gray-500 font-mono text-[10px] uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            <LiveTimer startTime={execution.createdAt} status={execution.status} />
          </div>

          {/* New Architecture Badges */}
          {execution.rcaResult?.errorType && (
            <div className="px-2 py-0.5 rounded-full bg-navy-700 text-[9px] font-bold text-gray-400 border border-white/5 uppercase">
              {execution.rcaResult.errorType}
            </div>
          )}

          {execution.rcaResult?.confidenceScore > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-8 h-1 bg-navy-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-heal-cyan shadow-[0_0_5px_rgba(0,243,255,0.5)]" 
                  style={{ width: `${execution.rcaResult.confidenceScore * 100}%` }}
                />
              </div>
              <span className="text-[9px] font-bold text-gray-500">
                {Math.round(execution.rcaResult.confidenceScore * 100)}%
              </span>
            </div>
          )}
        </div>

        {execution.prUrl && (
          <a
            href={execution.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-bold text-heal-cyan hover:text-white transition-colors flex items-center gap-1"
          >
            <span>PR #{execution.prNumber}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-heal-cyan animate-pulse" />
          </a>
        )}
      </div>
    </motion.div>
  );
}
