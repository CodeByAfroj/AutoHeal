import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useAutoQuery } from '../hooks/useAutoQuery';
import ExecutionCard from '../components/ExecutionCard';
import { Activity, Filter, RefreshCw } from 'lucide-react';

export default function PipelinesListPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(0);
  const limit = 20;

  // Utilize the new Persistence Hook for instant-load UI
  const { 
    data, 
    loading, 
    refetch 
  } = useAutoQuery(
    `pipelines_p${page}`, 
    `/api/executions?limit=${limit}&offset=${page * limit}`
  );

  const executions = data?.executions || [];
  const total = data?.total || 0;

  // Listen to Server-Sent Events (SSE) for real-time updates
  useEffect(() => {
    if (!token) return;

    const sse = new EventSource(`http://localhost:8000/api/executions/stream?token=${token}`);

    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'execution_updated') {
          // Silent background refetch ensures the cache is updated without a loading spinner
          refetch(true);
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    return () => sse.close();
  }, [token, refetch]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-extrabold text-white mb-2"
          >
            Pipelines
          </motion.h1>
          <p className="text-gray-400">{total} total executions</p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && executions.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="glass-card p-5 shimmer-bg h-24" />
          ))}
        </div>
      ) : executions.length > 0 ? (
        <>
          <div className="space-y-3">
            {executions.filter(e => e.status !== 'error').map((exec, i) => (
              <ExecutionCard key={exec._id} execution={exec} index={i} />
            ))}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {page + 1} of {Math.ceil(total / limit)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * limit >= total}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="glass-card p-12 text-center">
          <Activity className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-300 mb-1">No pipelines yet</h3>
          <p className="text-xs text-gray-500">
            Pipeline executions will appear here when CI failures are detected
          </p>
        </div>
      )}
    </div>
  );
}
