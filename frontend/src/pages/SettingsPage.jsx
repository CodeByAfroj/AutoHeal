import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Settings, User, Shield, Webhook, ExternalLink, Copy, Check } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const copyWebhookUrl = () => {
    const url = 'http://localhost:8000/webhook/github';
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-extrabold text-white mb-8"
      >
        Settings
      </motion.h1>

      {/* Profile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 mb-6"
      >
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-heal-cyan" />
          Profile
        </h2>
        <div className="flex items-center gap-4">
          <img
            src={user?.avatarUrl}
            alt={user?.username}
            className="w-16 h-16 rounded-xl ring-2 ring-heal-cyan/30"
          />
          <div>
            <h3 className="text-lg font-bold text-white">{user?.displayName || user?.username}</h3>
            <p className="text-sm text-gray-400">@{user?.username}</p>
            <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
          </div>
        </div>
      </motion.div>

      {/* Security */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 mb-6"
      >
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-heal-green" />
          Security
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-navy-900/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-300">GitHub Token</p>
              <p className="text-xs text-gray-500">AES-256-GCM encrypted at rest</p>
            </div>
            <span className="status-badge bg-heal-green/20 text-heal-green border border-heal-green/30">
              <span className="w-1.5 h-1.5 bg-heal-green rounded-full" />
              Secured
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-navy-900/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-300">OAuth Connection</p>
              <p className="text-xs text-gray-500">Connected via GitHub OAuth 2.0</p>
            </div>
            <a
              href={`https://github.com/${user?.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-heal-cyan flex items-center gap-1 hover:underline"
            >
              View Profile <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </motion.div>

      {/* Webhook */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Webhook className="w-4 h-4 text-heal-purple" />
          Webhook Configuration
        </h2>
        <div className="p-3 bg-navy-900/50 rounded-lg">
          <p className="text-xs text-gray-500 mb-2">Webhook Endpoint</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-heal-cyan font-mono bg-navy-900 px-3 py-2 rounded-lg truncate">
              /webhook/github
            </code>
            <button
              onClick={copyWebhookUrl}
              className="p-2 rounded-lg bg-navy-700 hover:bg-navy-600 transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-heal-green" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Webhooks are automatically managed when you enable/disable repositories.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
