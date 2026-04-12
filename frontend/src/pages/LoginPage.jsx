import { motion } from 'framer-motion';
import { Zap, Shield, Bot, GitPullRequest, ArrowRight } from 'lucide-react';
import GitHubIcon from '../components/GitHubIcon';

const API_URL = 'http://localhost:8000';

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = `${API_URL}/auth/github`;
  };

  const features = [
    { icon: Bot, label: 'AI-Powered Analysis', desc: 'Gemini 2.0 analyzes failures instantly' },
    { icon: GitPullRequest, label: 'Auto Fix PRs', desc: 'Generates code fixes and opens PRs' },
    { icon: Shield, label: 'Secure by Design', desc: 'Tokens encrypted, never exposed' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center circuit-bg relative overflow-hidden">
      {/* Animated orbs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-heal-cyan/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-heal-purple/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="flex flex-col items-center mb-8"
        >
          <div className="w-20 h-20 rounded-2xl bg-heal-gradient flex items-center justify-center mb-4 shadow-glow-cyan">
            <Zap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold gradient-text mb-2">AutoHeal</h1>
          <p className="text-gray-400 text-sm text-center">
            AI-Powered Self-Healing CI/CD Platform
          </p>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-8"
        >
          <h2 className="text-xl font-bold text-white text-center mb-2">Welcome Back</h2>
          <p className="text-sm text-gray-400 text-center mb-8">
            Connect your GitHub to start healing your CI/CD pipelines
          </p>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-4
              bg-white text-gray-900 rounded-xl font-bold text-base
              hover:bg-gray-100 transition-all duration-300 hover:shadow-xl
              hover:scale-[1.02] active:scale-[0.98] group"
          >
            <GitHubIcon className="w-6 h-6" />
            Sign in with GitHub
            <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
          </button>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500">Secure OAuth 2.0</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </motion.div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {features.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="text-center p-3 glass-card"
            >
              <f.icon className="w-5 h-5 text-heal-cyan mx-auto mb-2" />
              <p className="text-[10px] font-semibold text-gray-300 leading-tight">{f.label}</p>
              <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
