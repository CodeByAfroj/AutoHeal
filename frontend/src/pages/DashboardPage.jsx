import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import ExecutionCard from '../components/ExecutionCard';
import {
  Activity,
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Zap,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, apiFetch, token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Listen to Server-Sent Events (SSE) for real-time updates across the platform
  useEffect(() => {
    if (!token) return;

    const sse = new EventSource(`http://localhost:8000/api/executions/stream?token=${token}`);

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'execution_updated') {
          loadDashboardSilent();
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    return () => sse.close();
  }, [token]);

  const loadDashboardSilent = async () => {
    try {
      const [statsRes, execRes] = await Promise.all([
        apiFetch('/api/executions/stats'),
        apiFetch('/api/executions?limit=5')
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (execRes.ok) {
        const data = await execRes.json();
        setExecutions(data.executions);
      }
    } catch (err) {
      console.error('Dashboard silent load error:', err);
    }
  };

  const loadDashboard = async () => {
    try {
      const [statsRes, execRes] = await Promise.all([
        apiFetch('/api/executions/stats'),
        apiFetch('/api/executions?limit=5')
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (execRes.ok) {
        const data = await execRes.json();
        setExecutions(data.executions);
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats ? [
    {
      label: 'Total Pipelines',
      value: stats.totalExecutions,
      icon: Activity,
      color: 'from-cyan-500/20 to-cyan-500/5',
      textColor: 'text-heal-cyan',
      iconBg: 'bg-heal-cyan/10'
    },
    {
      label: 'Successful Fixes',
      value: stats.successfulFixes,
      icon: CheckCircle2,
      color: 'from-green-500/20 to-green-500/5',
      textColor: 'text-heal-green',
      iconBg: 'bg-heal-green/10'
    },
    {
      label: 'Active Now',
      value: stats.activePipelines,
      icon: Zap,
      color: 'from-purple-500/20 to-purple-500/5',
      textColor: 'text-heal-purple',
      iconBg: 'bg-heal-purple/10'
    },
    {
      label: 'Success Rate',
      value: `${stats.successRate}%`,
      icon: TrendingUp,
      color: 'from-amber-500/20 to-amber-500/5',
      textColor: 'text-heal-amber',
      iconBg: 'bg-heal-amber/10'
    },
  ] : [];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-extrabold text-white mb-2"
        >
          Welcome back, <span className="gradient-text">{user?.displayName || user?.username}</span>
        </motion.h1>
        <p className="text-gray-400">Here's what's happening with your pipelines today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`glass-card p-5 bg-gradient-to-br ${stat.color}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.textColor}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${stat.textColor}`}>{stat.value}</p>
            <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          onClick={() => navigate('/app/repos')}
          className="glass-card-hover p-5 text-left group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-heal-gradient/10 flex items-center justify-center">
                <FolderGit2 className="w-5 h-5 text-heal-cyan" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Enable a Repository</h3>
                <p className="text-xs text-gray-400">Connect your repos to start self-healing</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-heal-cyan group-hover:translate-x-1 transition-all" />
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          onClick={() => navigate('/app/pipelines')}
          className="glass-card-hover p-5 text-left group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-heal-purple/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-heal-purple" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">View All Pipelines</h3>
                <p className="text-xs text-gray-400">Monitor execution progress and approvals</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-heal-purple group-hover:translate-x-1 transition-all" />
          </div>
        </motion.button>
      </div>

      {/* Recent Executions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Recent Pipelines</h2>
          {executions.length > 0 && (
            <button
              onClick={() => navigate('/app/pipelines')}
              className="text-xs text-heal-cyan hover:text-heal-cyan/80 transition-colors"
            >
              View all →
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card p-5 shimmer-bg h-24" />
            ))}
          </div>
        ) : executions.length > 0 ? (
          <div className="space-y-3">
            {executions.map((exec, i) => (
              <ExecutionCard key={exec._id} execution={exec} index={i} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <AlertTriangle className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-300 mb-1">No pipelines yet</h3>
            <p className="text-xs text-gray-500 mb-4">
              Enable self-healing on a repository to get started
            </p>
            <button onClick={() => navigate('/app/repos')} className="btn-primary text-sm">
              Enable a Repository
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
