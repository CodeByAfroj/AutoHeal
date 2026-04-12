import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import PipelineTimeline from '../components/PipelineTimeline';
import DiffViewer from '../components/DiffViewer';
import ApprovalModal from '../components/ApprovalModal';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeft, ExternalLink, GitCommit, Clock, Bot, CheckCircle2, XCircle } from 'lucide-react';

export default function PipelinePage() {
  const { id } = useParams();
  const { apiFetch } = useAuth();
  const navigate = useNavigate();

  const [execution, setExecution] = useState(null);
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApproval, setShowApproval] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadExecution = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/executions/${id}/status`);
      if (res.ok) {
        const data = await res.json();
        setExecution(data.execution);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadDiff = async () => {
    try {
      const res = await apiFetch(`/api/executions/${id}/diff`);
      if (res.ok) {
        const data = await res.json();
        setDiff(data.diff);
      }
    } catch (err) {
      console.error('Diff load error:', err);
    }
  };

  useEffect(() => {
    loadExecution();
  }, [loadExecution]);

  // Poll for updates if not in terminal state
  useEffect(() => {
    if (!execution) return;
    if (['merged', 'approved', 'rejected', 'error'].includes(execution.status)) return;

    const interval = setInterval(loadExecution, 5000);
    return () => clearInterval(interval);
  }, [execution?.status, loadExecution]);

  // Load diff when PR is created
  useEffect(() => {
    if (execution?.prNumber && !diff) {
      loadDiff();
    }
  }, [execution?.prNumber]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/executions/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        setExecution(prev => ({ ...prev, status: 'merged' }));
        setShowApproval(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Merge failed');
      }
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/executions/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        setExecution(prev => ({ ...prev, status: 'rejected' }));
        setShowApproval(false);
      }
    } catch (err) {
      console.error('Reject error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (d) => new Date(d).toLocaleString();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-3 border-heal-cyan/30 border-t-heal-cyan rounded-full animate-spin" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="glass-card p-12 text-center">
        <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-gray-300">Execution not found</h3>
      </div>
    );
  }

  const showActions = ['pr_created', 'awaiting_approval', 'ai_complete'].includes(execution.status) && execution.prNumber;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-navy-700/50 border border-white/5
            flex items-center justify-center text-gray-400 hover:text-white hover:border-white/10 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-extrabold text-white flex items-center gap-3"
          >
            {execution.repoFullName}
            <StatusBadge status={execution.status} size="lg" />
          </motion.h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5" />
              <span className="font-mono">{execution.commitSha?.substring(0, 7)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(execution.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2"
        >
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Bot className="w-5 h-5 text-heal-cyan" />
              Pipeline Progress
            </h2>
            <PipelineTimeline execution={execution} />

            {/* Action buttons */}
            {showActions && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 pt-6 border-t border-white/5 flex gap-3"
              >
                <button
                  onClick={() => setShowApproval(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Review & Approve
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="btn-danger flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Fix
                </button>
                {execution.prUrl && (
                  <a
                    href={execution.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on GitHub
                  </a>
                )}
              </motion.div>
            )}
          </div>

          {/* Diff */}
          {diff && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6"
            >
              <DiffViewer diff={diff} />
            </motion.div>
          )}
        </motion.div>

        {/* Sidebar info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {/* RCA Card */}
          {execution.rcaResult?.rootCause && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Bot className="w-4 h-4 text-heal-purple" />
                AI Analysis
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Root Cause</p>
                  <p className="text-sm text-gray-300">{execution.rcaResult.rootCause}</p>
                </div>
                {execution.rcaResult.targetFile && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Target File</p>
                    <p className="text-sm text-heal-cyan font-mono">{execution.rcaResult.targetFile}</p>
                  </div>
                )}
                {execution.rcaResult.fixPlan && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Fix Plan</p>
                    <p className="text-sm text-gray-300">{execution.rcaResult.fixPlan}</p>
                  </div>
                )}
                {execution.rcaResult.confidenceScore > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Confidence</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-navy-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-heal-gradient rounded-full transition-all duration-500"
                          style={{ width: `${execution.rcaResult.confidenceScore * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">
                        {Math.round(execution.rcaResult.confidenceScore * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Logs */}
          {execution.errorLogs && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-bold text-white mb-3">Error Logs</h3>
              <pre className="text-xs text-gray-400 font-mono bg-navy-900/50 p-3 rounded-lg
                max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                {execution.errorLogs.substring(0, 2000)}
              </pre>
            </div>
          )}

          {/* Metadata */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-white mb-3">Details</h3>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-gray-500">Branch</dt>
                <dd className="text-gray-300 font-mono">{execution.branch}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Commit</dt>
                <dd className="text-gray-300 font-mono">{execution.commitSha?.substring(0, 12)}</dd>
              </div>
              {execution.fixBranch && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Fix Branch</dt>
                  <dd className="text-gray-300 font-mono truncate max-w-[160px]">{execution.fixBranch}</dd>
                </div>
              )}
              {execution.kestraExecutionId && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Kestra ID</dt>
                  <dd className="text-gray-300 font-mono truncate max-w-[160px]">{execution.kestraExecutionId}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-300">{formatDate(execution.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </motion.div>
      </div>

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={showApproval}
        onClose={() => setShowApproval(false)}
        onApprove={handleApprove}
        onReject={handleReject}
        execution={execution}
        loading={actionLoading}
      />
    </div>
  );
}
