import { useState } from 'react';
import { motion } from 'framer-motion';
import { Code2, ChevronDown, ChevronUp } from 'lucide-react';

export default function DiffViewer({ diff }) {
  const [expanded, setExpanded] = useState(true);

  if (!diff) return null;

  const lines = diff.split('\n');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 border-b border-white/5
          hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-heal-cyan" />
          <span className="text-sm font-semibold text-gray-200">Diff Preview</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Diff content */}
      {expanded && (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <pre className="p-4 text-xs font-mono leading-relaxed">
            {lines.map((line, i) => {
              let color = 'text-gray-400';
              let bg = '';

              if (line.startsWith('+') && !line.startsWith('+++')) {
                color = 'text-green-400';
                bg = 'bg-green-500/5';
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                color = 'text-red-400';
                bg = 'bg-red-500/5';
              } else if (line.startsWith('@@')) {
                color = 'text-cyan-400';
                bg = 'bg-cyan-500/5';
              } else if (line.startsWith('diff') || line.startsWith('index')) {
                color = 'text-gray-500';
              }

              return (
                <div key={i} className={`${bg} px-2 -mx-2 ${color}`}>
                  {line || ' '}
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </motion.div>
  );
}
