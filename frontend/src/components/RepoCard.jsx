import { motion } from 'framer-motion';
import { Shield, ToggleLeft, ToggleRight, Star, GitBranch, Circle } from 'lucide-react';

const languageColors = {
  JavaScript: '#f7df1e',
  TypeScript: '#3178c6',
  Python: '#3572a5',
  Java: '#b07219',
  Go: '#00add8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4f5d95',
  'C++': '#f34b7d',
  C: '#555555',
  Swift: '#ffac45',
  Kotlin: '#a97bff',
  Dart: '#00b4ab',
};

export default function RepoCard({ repo, onEnable, onDisable, loading, index = 0 }) {
  const langColor = languageColors[repo.language] || '#6b7280';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`glass-card p-5 transition-all duration-300
        ${repo.enabled
          ? 'border-heal-cyan/20 shadow-glow-cyan'
          : 'hover:border-white/10'
        }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-200 truncate">{repo.name}</h3>
            {repo.private && (
              <Shield className="w-3 h-3 text-gray-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-400 truncate mb-2">{repo.fullName}</p>
        </div>

        {/* Enable/Disable Toggle */}
        <button
          onClick={() => repo.enabled ? onDisable(repo) : onEnable(repo)}
          disabled={loading}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
            transition-all duration-300
            ${repo.enabled
              ? 'bg-heal-cyan/10 text-heal-cyan border border-heal-cyan/30 hover:bg-heal-cyan/20'
              : 'bg-navy-700/50 text-gray-400 border border-white/5 hover:border-heal-cyan/20 hover:text-gray-300'
            }
            ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {repo.enabled ? (
            <>
              <ToggleRight className="w-4 h-4" />
              Active
            </>
          ) : (
            <>
              <ToggleLeft className="w-4 h-4" />
              Enable
            </>
          )}
        </button>
      </div>

      {repo.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{repo.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-500">
        {repo.language && (
          <span className="flex items-center gap-1.5">
            <Circle className="w-2.5 h-2.5 fill-current" style={{ color: langColor }} />
            {repo.language}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3" />
          {repo.stars}
        </span>
        <span className="flex items-center gap-1">
          <GitBranch className="w-3 h-3" />
          {repo.defaultBranch}
        </span>
      </div>

      {repo.enabled && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-3 pt-3 border-t border-white/5"
        >
          <div className="flex items-center gap-2 text-xs text-heal-green">
            <div className="w-1.5 h-1.5 bg-heal-green rounded-full pulse-dot" />
            Self-healing active — monitoring CI failures
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
