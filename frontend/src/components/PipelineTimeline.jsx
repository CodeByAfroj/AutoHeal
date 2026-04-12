import { motion } from 'framer-motion';
import { AlertCircle, FileText, Bot, GitPullRequest, Check, X } from 'lucide-react';
import StatusBadge from './StatusBadge';

const pipelineSteps = [
  { key: 'ci_failed', icon: AlertCircle, label: 'CI Failed', desc: 'Test failure detected' },
  { key: 'logs_processed', icon: FileText, label: 'Logs Processed', desc: 'Error logs analyzed' },
  { key: 'ai_running', icon: Bot, label: 'AI Fix Running', desc: 'Analyzing root cause & generating fix' },
  { key: 'pr_created', icon: GitPullRequest, label: 'PR Created', desc: 'Fix branch pushed & PR opened' },
  { key: 'merged', icon: Check, label: 'Resolved', desc: 'Fix approved and merged' },
];

const stageOrder = ['ci_failed', 'logs_processed', 'ai_running', 'ai_complete', 'pr_created', 'awaiting_approval', 'approved', 'merged'];

function getStageIndex(status) {
  const idx = stageOrder.indexOf(status);
  return idx >= 0 ? idx : -1;
}

export default function PipelineTimeline({ execution }) {
  const currentStageIdx = getStageIndex(execution?.status);
  const isError = execution?.status === 'error';
  const isRejected = execution?.status === 'rejected';

  return (
    <div className="relative">
      {pipelineSteps.map((step, idx) => {
        const stepIdx = getStageIndex(step.key);
        const isCompleted = currentStageIdx > stepIdx;
        const isCurrent = currentStageIdx === stepIdx ||
          (step.key === 'ai_running' && ['ai_running', 'ai_complete'].includes(execution?.status)) ||
          (step.key === 'pr_created' && ['pr_created', 'awaiting_approval', 'approved'].includes(execution?.status)) ||
          (step.key === 'merged' && execution?.status === 'merged');
        const isFuture = !isCompleted && !isCurrent;

        return (
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="relative flex gap-4 pb-8 last:pb-0"
          >
            {/* Timeline connector */}
            {idx < pipelineSteps.length - 1 && (
              <div className={`absolute left-5 top-12 bottom-0 w-0.5
                ${isCompleted ? 'bg-heal-green/50' : 'bg-navy-600'}`}
              />
            )}

            {/* Step circle */}
            <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
              transition-all duration-500
              ${isCompleted
                ? 'bg-heal-green/20 border-2 border-heal-green/50'
                : isCurrent
                  ? 'bg-heal-cyan/20 border-2 border-heal-cyan/50 shadow-glow-cyan'
                  : 'bg-navy-700 border-2 border-navy-600'
              }
              ${isCurrent && !isError ? 'animate-pulse-slow' : ''}
              ${isError && isCurrent ? 'bg-red-500/20 border-red-500/50' : ''}`}
            >
              <step.icon className={`w-4 h-4
                ${isCompleted ? 'text-heal-green' : isCurrent ? 'text-heal-cyan' : 'text-gray-500'}
                ${isError && isCurrent ? 'text-red-400' : ''}`}
              />
            </div>

            {/* Step content */}
            <div className={`flex-1 pt-1 ${isFuture ? 'opacity-40' : ''}`}>
              <div className="flex items-center gap-3 mb-1">
                <h4 className={`text-sm font-semibold
                  ${isCompleted ? 'text-heal-green' : isCurrent ? 'text-white' : 'text-gray-500'}`}>
                  {step.label}
                </h4>
                {isCurrent && <StatusBadge status={execution?.status} />}
              </div>
              <p className="text-xs text-gray-500">{step.desc}</p>

              {/* Extra info for current step */}
              {isCurrent && execution?.status === 'pr_created' && execution?.prUrl && (
                <a
                  href={execution.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs
                    bg-heal-cyan/10 text-heal-cyan rounded-lg hover:bg-heal-cyan/20 transition-colors"
                >
                  <GitPullRequest className="w-3 h-3" />
                  View PR #{execution.prNumber}
                </a>
              )}

              {isCurrent && execution?.rcaResult?.rootCause && step.key === 'ai_running' && (
                <div className="mt-2 p-3 bg-navy-900/50 rounded-lg border border-white/5">
                  <p className="text-xs text-gray-400 mb-1 font-medium">Root Cause:</p>
                  <p className="text-xs text-gray-300">{execution.rcaResult.rootCause}</p>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}

      {/* Error / Rejected Overlay */}
      {(isError || isRejected) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
        >
          <div className="flex items-center gap-2 text-red-400 mb-1">
            <X className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {isError ? 'Pipeline Error' : 'Fix Rejected'}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            {execution?.errorMessage || 'The AI-generated fix was rejected.'}
          </p>
        </motion.div>
      )}
    </div>
  );
}
