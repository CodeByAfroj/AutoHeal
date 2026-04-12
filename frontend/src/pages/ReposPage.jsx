import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import RepoCard from '../components/RepoCard';
import { Search, FolderGit2, Loader2, RefreshCw } from 'lucide-react';

export default function ReposPage() {
  const { apiFetch } = useAuth();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, enabled, disabled

  useEffect(() => {
    loadRepos();
  }, []);

  const loadRepos = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/repos');
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
      }
    } catch (err) {
      console.error('Failed to load repos:', err);
    } finally {
      setLoading(false);
    }
  };

  const enableRepo = async (repo) => {
    setActionLoading(repo.id);
    try {
      const res = await apiFetch(`/api/repos/${repo.id}/enable`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: repo.fullName,
          name: repo.name,
          defaultBranch: repo.defaultBranch,
          language: repo.language,
          description: repo.description
        })
      });

      if (res.ok) {
        setRepos(repos.map(r =>
          r.id === repo.id ? { ...r, enabled: true } : r
        ));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to enable');
      }
    } catch (err) {
      console.error('Enable error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const disableRepo = async (repo) => {
    setActionLoading(repo.id);
    try {
      const res = await apiFetch(`/api/repos/${repo.id}/disable`, {
        method: 'POST'
      });

      if (res.ok) {
        setRepos(repos.map(r =>
          r.id === repo.id ? { ...r, enabled: false } : r
        ));
      }
    } catch (err) {
      console.error('Disable error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredRepos = repos.filter(r => {
    const matchSearch = r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'enabled' && r.enabled) || (filter === 'disabled' && !r.enabled);
    return matchSearch && matchFilter;
  });

  const enabledCount = repos.filter(r => r.enabled).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-extrabold text-white mb-2"
          >
            Repositories
          </motion.h1>
          <p className="text-gray-400">
            {repos.length} repos found • {enabledCount} active
          </p>
        </div>

        <button
          onClick={loadRepos}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        <div className="flex gap-2">
          {['all', 'enabled', 'disabled'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                ${filter === f
                  ? 'bg-heal-cyan/10 text-heal-cyan border border-heal-cyan/30'
                  : 'bg-navy-700/50 text-gray-400 border border-white/5 hover:border-white/10'
                }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Repos Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass-card p-5 shimmer-bg h-40" />
          ))}
        </div>
      ) : filteredRepos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRepos.map((repo, i) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              onEnable={enableRepo}
              onDisable={disableRepo}
              loading={actionLoading === repo.id}
              index={i}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <FolderGit2 className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-300 mb-1">No repositories found</h3>
          <p className="text-xs text-gray-500">
            {search ? 'Try a different search term' : 'No repositories available'}
          </p>
        </div>
      )}
    </div>
  );
}
