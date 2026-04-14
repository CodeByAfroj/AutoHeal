import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    Zap,
    Shield,
    Cpu,
    ArrowRight,
    CheckCircle2,
    Activity,
    Code2,
    Terminal,
    Check,
    GitPullRequest,
    ExternalLink,
    Bot,
    XCircle,
    Clock,
    GitCommit,
    LayoutDashboard,
    RefreshCw,
    Loader2
} from 'lucide-react';
import GitHubIcon from '../components/GitHubIcon';
import { useAuth } from '../contexts/AuthContext';
import PipelineTimeline from '../components/PipelineTimeline';

const FeatureCard = ({ icon: Icon, title, description, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay }}
        className="glass-card-hover p-8 group"
    >
        <div className="w-14 h-14 bg-heal-gradient-soft rounded-2xl flex items-center justify-center mb-6 border border-heal-cyan/20 group-hover:scale-110 transition-transform duration-300">
            <Icon className="w-8 h-8 text-heal-cyan" />
        </div>
        <h3 className="text-xl font-bold mb-4 text-white group-hover:text-heal-cyan transition-colors">{title}</h3>
        <p className="text-gray-400 leading-relaxed">{description}</p>
    </motion.div>
);

const Step = ({ number, title, description }) => (
    <div className="flex gap-6 items-start">
        <div className="flex-shrink-0 w-12 h-12 bg-navy-800 border border-white/10 rounded-full flex items-center justify-center text-heal-cyan font-bold text-lg shadow-glow-cyan/10">
            {number}
        </div>
        <div>
            <h4 className="text-lg font-semibold mb-2 text-white">{title}</h4>
            <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
        </div>
    </div>
);

export default function HomePage() {
    const { user } = useAuth();

    // Real-time Simulation State
    const [simStatus, setSimStatus] = React.useState('ci_failed');
    const [simStep, setSimStep] = React.useState(0);
    const [userAction, setUserAction] = React.useState(null); // 'approved', 'rejected'

    React.useEffect(() => {
        if (userAction) return; // Stop auto-cycle if user acted

        const sequence = ['ci_failed', 'logs_processed', 'ai_running', 'pr_created'];
        const timer = setInterval(() => {
            setSimStep(prev => {
                if (prev >= sequence.length - 1) {
                    clearInterval(timer);
                    return prev;
                }
                const next = prev + 1;
                const nextStatus = sequence[next];
                setSimStatus(nextStatus);
                return next;
            });
        }, 3000);

        return () => clearInterval(timer);
    }, [userAction]);

    // Handle interactive actions
    const handleApprove = () => {
        setUserAction('approved');
        setSimStatus('merging');
        setTimeout(() => setSimStatus('merged'), 1500);
    };

    const handleReject = () => {
        setUserAction('rejected');
        setSimStatus('cancelled');
    };

    const handleReset = () => {
        setUserAction(null);
        setSimStep(0);
        setSimStatus('ci_failed');
    };

    const FEATURE_EXECUTION = {
        status: simStatus,
        prUrl: '#',
        prNumber: '882',
        rcaResult: {
            rootCause: simStep >= 2 ? 'ModuleNotFound error in auth_helper.py - Incorrect relative import path.' : '',
            targetFile: simStep >= 2 ? 'src/auth/auth_helper.py, src/core/auth.py' : '',
            fixPlan: simStep >= 3 ? 'Update the absolute import to a relative import to match the current directory structure and ensure the auth module is exported.' : '',
            confidenceScore: simStep >= 2 ? 0.95 : 0
        }
    };

    return (
        <div className="min-h-screen bg-navy-900 overflow-hidden">
            <style>
                {`
                @keyframes flow {
                    0% { background-position: 0% 0%; }
                    100% { background-position: 0% 200%; }
                }
                /* Target connectors in PipelineTimeline */
                .timeline-flow div.absolute.left-5.top-12.bottom-0.w-0.5 {
                    background: linear-gradient(180deg, rgba(6,182,212,0.1) 0%, rgba(6,182,212,1) 50%, rgba(6,182,212,0.1) 100%);
                    background-size: 100% 200%;
                    animation: flow 1.5s linear infinite;
                    box-shadow: 0 0 10px rgba(6,182,212,0.3);
                }
                `}
            </style>

            {/* Decorative background elements */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-heal-cyan/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-heal-purple/10 rounded-full blur-[120px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full circuit-bg opacity-30" />
            </div>

            {/* Navigation */}
            <nav className="relative z-50 border-b border-white/5 bg-navy-900/50 backdrop-blur-lg">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-heal-gradient rounded-xl flex items-center justify-center shadow-glow-cyan">
                            <Activity className="text-white w-6 h-6" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-white">
                            Auto<span className="gradient-text">Heal</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="hidden md:flex items-center gap-6">
                            <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</a>
                            <a href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Workflow</a>
                        </div>
                        {user ? (
                            <Link to="/app/dashboard" className="btn-primary px-6 py-2.5 text-sm">
                                Dashboard
                            </Link>
                        ) : (
                            <Link to="/login" className="btn-primary px-6 py-2.5 text-sm">
                                Sign In
                            </Link>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-10 pb-32 px-6">
                <div className="max-w-7xl mx-auto text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-8"
                    >
                        <span className="w-2 h-2 rounded-full bg-heal-cyan animate-pulse" />
                        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Self-Healing CI/CD v2.0</span>
                    </motion.div>


                    <h1 className="text-6xl md:text-8xl font-extrabold text-white mb-8 tracking-tighter leading-tight">
                        Self-Healing <br />
                        <span className="gradient-text">Software Pipelines</span>
                    </h1>

                    <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                        Autonomous AI agent that detects, diagnoses, and repairs pipeline failures in real-time.
                        Zero manual intervention, maximum developer productivity.
                    </p>


                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.6 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-6"
                    >
                        <Link to={user ? "/app/dashboard" : "/login"} className="btn-primary px-8 py-4 text-lg flex items-center gap-2 w-full sm:w-auto justify-center shadow-glow-cyan">
                            {user ? "Go to Dashboard" : "Get Started Now"} <ArrowRight className="w-5 h-5" />
                        </Link>
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn-secondary px-8 py-4 text-lg flex items-center gap-2 w-full sm:w-auto justify-center">
                            <GitHubIcon className="w-5 h-5" /> Star on GitHub
                        </a>
                    </motion.div>

                    {/* Realistic Dashboard Mockup */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.3 }}
                        className="mt-24 relative group"
                    >
                        <div className="absolute inset-0 bg-heal-gradient opacity-[0.07] blur-[120px] -z-10 group-hover:opacity-[0.12] transition-opacity duration-700" />

                        <div className="glass-card border-white/10 p-1 rounded-3xl shadow-2xl max-w-5xl mx-auto backdrop-blur-3xl overflow-hidden">
                            {/* Browser Header */}
                            <div className="bg-navy-900/80 border-b border-white/5 p-4 flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-red-500/30" />
                                        <div className="w-3 h-3 rounded-full bg-amber-500/30" />
                                        <div className="w-3 h-3 rounded-full bg-green-500/30" />
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-navy-800 rounded-lg border border-white/5">
                                        <Code2 className="w-3.5 h-3.5 text-gray-500" />
                                        <span className="text-[11px] font-mono text-gray-400">autoheal/frontend-service</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 min-h-[500px]">
                                {/* Sidebar */}
                                <div className="col-span-3 border-r border-white/5 bg-navy-900/30 p-4 space-y-6 text-left">
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">Pinned Repos</p>
                                        {[
                                            { name: 'api-gateway', status: 'green' },
                                            { name: 'auth-service', status: 'green' },
                                            { name: 'web-dashboard', status: simStatus === 'merged' ? 'green' : 'red' },
                                            { name: 'worker-node', status: 'green' }
                                        ].map(repo => (
                                            <div key={repo.name} className={`flex items-center gap-3 p-2 rounded-xl border border-transparent transition-all ${repo.status === 'red' ? 'bg-red-500/5 border-red-500/10' : 'hover:bg-white/5'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${repo.status === 'green' ? 'bg-heal-green' : 'bg-heal-red animate-pulse'}`} />
                                                <span className={`text-xs font-medium ${repo.status === 'red' ? 'text-heal-red' : 'text-gray-400'}`}>{repo.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Main Content Area (Scrollable) */}
                                <div className="col-span-9 flex flex-col h-[600px] overflow-hidden">
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6">

                                        {/* Status Banner */}
                                        <div className={`
                                            ${simStatus === 'ci_failed' ? 'bg-heal-red/10 border-heal-red/20' :
                                                simStatus === 'merged' ? 'bg-heal-green/10 border-heal-green/20' :
                                                    simStatus === 'merging' ? 'bg-amber-500/10 border-amber-500/20' :
                                                        'bg-navy-800/50 border-white/5'} 
                                            border rounded-2xl p-4 flex items-center justify-between transition-colors duration-500`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${simStatus === 'ci_failed' ? 'bg-heal-red/20 text-heal-red' :
                                                    simStatus === 'merged' ? 'bg-heal-green/20 text-heal-green' :
                                                        simStatus === 'merging' ? 'bg-amber-500/20 text-amber-500 animate-spin' :
                                                            'bg-gray-500/20 text-gray-500'
                                                    }`}>
                                                    {simStatus === 'merging' ? <Loader2 className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                                                </div>
                                                <p className={`text-xs font-bold uppercase tracking-tight ${simStatus === 'ci_failed' ? 'text-heal-red' :
                                                    simStatus === 'merged' ? 'text-heal-green' :
                                                        simStatus === 'merging' ? 'text-amber-500' :
                                                            'text-white'
                                                    }`}>
                                                    {simStatus === 'ci_failed' ? 'Critical Failure Detected' :
                                                        simStatus === 'merging' ? 'Autonomous Merge in Progress' :
                                                            simStatus === 'merged' ? 'Pipeline Health: Stable' :
                                                                simStatus === 'cancelled' ? 'Operation Aborted by User' : 'Awaiting Review'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4 text-[10px] text-gray-500 font-mono">
                                                <span className="flex items-center gap-1.5"><GitCommit className="w-3 h-3" /> 9f49311</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-12 gap-6">
                                            {/* Column 1: Timeline */}
                                            <div className="col-span-12 lg:col-span-7 space-y-6">
                                                <div className="glass-card p-6 bg-navy-900/40">
                                                    <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                                                        <Bot className="w-4 h-4 text-heal-cyan" />
                                                        Pipeline Progress
                                                    </h3>
                                                    <div className="timeline-flow transform scale-90 -ml-4 origin-top-left">
                                                        <PipelineTimeline execution={FEATURE_EXECUTION} />
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className={`flex gap-3 transition-all duration-700 ${simStep >= 3 || userAction ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                                                    {userAction === 'rejected' ? (
                                                        <button
                                                            onClick={handleReset}
                                                            className="flex-1 bg-navy-800 border border-white/10 py-3 rounded-xl text-[10px] flex items-center justify-center gap-2 text-gray-400 font-bold hover:bg-white/5 transition-colors"
                                                        >
                                                            <RefreshCw className="w-3.5 h-3.5" /> Restart Simulation
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={handleApprove}
                                                                disabled={!!userAction}
                                                                className={`flex-1 py-3 rounded-xl text-[10px] flex items-center justify-center gap-2 font-bold transition-all duration-500 shadow-glow-cyan ${simStatus === 'merged'
                                                                    ? 'bg-heal-green text-white shadow-glow-green'
                                                                    : simStatus === 'merging'
                                                                        ? 'bg-heal-cyan/50 text-white cursor-wait'
                                                                        : 'btn-primary text-white'
                                                                    }`}
                                                            >
                                                                {simStatus === 'merged' ? (
                                                                    <><Check className="w-3.5 h-3.5" /> Fix Deployed</>
                                                                ) : simStatus === 'merging' ? (
                                                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Merging Fix...</>
                                                                ) : (
                                                                    <><Check className="w-3.5 h-3.5" /> Review & Approve</>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={handleReject}
                                                                disabled={!!userAction}
                                                                className={`px-5 border border-heal-red/30 text-heal-red hover:bg-heal-red/10 rounded-xl text-xs transition-all ${userAction === 'approved' ? 'opacity-0 scale-90 w-0 px-0' : ''}`}
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                            {simStatus === 'merged' && (
                                                                <button
                                                                    onClick={handleReset}
                                                                    className="px-4 bg-white/5 border border-white/10 text-gray-400 rounded-xl hover:text-white transition-colors"
                                                                >
                                                                    <RefreshCw className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {!userAction && (
                                                                <button className="px-4 bg-white/5 border border-white/10 text-gray-400 rounded-xl">
                                                                    <ExternalLink className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Column 2: Details */}
                                            <div className="col-span-12 lg:col-span-5 space-y-6">
                                                {/* AI Analysis Card */}
                                                <div className={`glass-card p-5 bg-navy-900/40 border-white/5 transition-all duration-700 ${simStep >= 2 ? 'opacity-100 scale-100' : 'opacity-30 scale-95'}`}>
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h3 className="text-xs font-bold text-white flex items-center gap-2">
                                                            <Bot className="w-3.5 h-3.5 text-heal-purple" />
                                                            AI Analysis
                                                        </h3>
                                                        {simStatus === 'merging' && <div className="text-[9px] text-heal-cyan animate-pulse font-bold uppercase">Processing...</div>}
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Root Cause</p>
                                                            <p className="text-xs text-gray-300 leading-relaxed">{FEATURE_EXECUTION.rcaResult.rootCause || 'Analyzing...'}</p>
                                                        </div>
                                                        {simStep >= 2 && (
                                                            <div>
                                                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Target File</p>
                                                                <p className="text-xs text-heal-cyan font-mono truncate">{FEATURE_EXECUTION.rcaResult.targetFile}</p>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Confidence</p>
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex-1 h-1.5 bg-navy-900 rounded-full overflow-hidden">
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${FEATURE_EXECUTION.rcaResult.confidenceScore * 100}%` }}
                                                                        className="h-full bg-heal-gradient"
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-gray-400">95%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Error Logs Card */}
                                                <div className="glass-card p-5 bg-black/40 border-white/5 font-mono text-[10px] text-left">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="text-gray-500 font-bold uppercase tracking-widest">System Logs</span>
                                                        <Terminal className="w-3 h-3 text-gray-600" />
                                                    </div>
                                                    <div className="space-y-1 text-gray-500">
                                                        {simStatus === 'ci_failed' && <p><span className="text-heal-red">✖</span> ModuleNotFoundError: No module named 'calc'</p>}
                                                        {simStep >= 1 && <p><span className="text-heal-purple">→</span> Log analysis complete. Identifying root cause...</p>}
                                                        {simStep >= 2 && <p><span className="text-heal-cyan">▶</span> Root Cause found: Relative import mismatch.</p>}
                                                        {simStep >= 3 && <p><span className="text-heal-green">✓</span> PR #882 created and validated.</p>}
                                                        {simStatus === 'merging' && <p className="animate-pulse text-amber-500">→ Requesting administrative merge...</p>}
                                                        {simStatus === 'merged' && <p className="text-heal-green">✓ PR #882 successfully merged to main.</p>}
                                                        {simStatus === 'cancelled' && <p className="text-heal-red">✖ Operation aborted. No changes applied.</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Diff Preview */}
                                        <div className={`glass-card p-5 bg-navy-950/50 border-white/5 transition-all duration-1000 ${simStep >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                                            <div className="flex items-center gap-2 mb-4">
                                                <Code2 className="w-4 h-4 text-heal-cyan" />
                                                <h3 className="text-xs font-bold text-white">Proposed Fix Preview</h3>
                                            </div>
                                            <div className="rounded-xl overflow-hidden border border-white/5 text-[11px] font-mono text-left">
                                                <div className="bg-navy-900/50 p-2 border-b border-white/5 text-gray-400">test_calc.py</div>
                                                <div className="p-3 bg-black/20 space-y-1">
                                                    <div className="text-heal-red"> - import calc</div>
                                                    <div className="text-heal-green">+ from src import calc</div>
                                                    <div className="text-gray-600 italic">... rest of file ...</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-4 gap-4 mt-6">
                                            {[
                                                { label: 'MTTR', val: '2.4 min', change: '-88%' },
                                                { label: 'Success', val: '99.2%', change: '+12%' },
                                                { label: 'Healed', val: '1,429', change: '+42' },
                                                { label: 'Saved', val: '240h', change: 'This wk' }
                                            ].map(stat => (
                                                <div key={stat.label} className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{stat.label}</p>
                                                    <div className="flex items-end justify-between mt-1">
                                                        <span className="text-lg font-bold text-white tracking-tight">{stat.val}</span>
                                                        <span className={`text-[8px] font-bold ${stat.change.startsWith('+') ? 'text-heal-green' : 'text-heal-cyan'}`}>{stat.change}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 px-6 relative">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-white mb-4">Engineered for Reliability</h2>
                        <p className="text-gray-400">Advanced AI capabilities to keep your production green.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={Cpu}
                            title="Autonomous Diagnosis"
                            description="Deep analysis of stack traces, logs, and code changes to identify the exact root cause of any pipeline failure."
                            delay={0.1}
                        />
                        <FeatureCard
                            icon={Shield}
                            title="Self-Healing Patches"
                            description="AI-generated code fixes are automatically validated through shadow-branch testing before being proposed as PRs."
                            delay={0.2}
                        />
                        <FeatureCard
                            icon={Zap}
                            title="Instant Resolution"
                            description="Go from failure to fix in seconds. Reduce MTTR from hours to minutes with our lightning-fast agentic workflow."
                            delay={0.3}
                        />
                    </div>
                </div>
            </section>

            {/* Technology Intelligence Showcase */}
            <section id="how-it-works" className="py-32 px-6 relative bg-navy-950/40">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-24">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-heal-purple/10 border border-heal-purple/20 text-xs font-bold text-heal-purple uppercase tracking-widest mb-6">
                            The Tech Stack
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">How the Magic Happens.</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto text-lg">We've automated the entire troubleshooting lifecycle with a proprietary stack of agentic technologies.</p>
                    </div>

                    <div className="max-w-7xl mx-auto relative">
                        {/* The Unified Process Circuit - Global Connections */}
                        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                            <svg className="w-full h-full" viewBox="0 0 1000 800" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="connectGrad" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
                                        <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                                    </linearGradient>
                                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="3" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                </defs>

                                {/* Connector 1: RAG -> Synthesis (Horizontal) */}
                                <path d="M 450 200 L 550 200" stroke="rgba(34, 211, 238, 0.1)" strokeWidth="2" fill="none" />
                                <motion.circle 
                                    cx="450" cy="200" r="3" fill="#22d3ee" filter="url(#glow)"
                                    animate={{ cx: [450, 550], opacity: [0, 1, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                />

                                {/* Connector 2: Synthesis -> Shadow Branch (Vertical) */}
                                <path d="M 750 350 L 750 450" stroke="rgba(34, 211, 238, 0.1)" strokeWidth="2" fill="none" />
                                <motion.circle 
                                    cx="750" cy="350" r="3" fill="#22d3ee" filter="url(#glow)"
                                    animate={{ cy: [350, 450], opacity: [0, 1, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                                />

                                {/* Connector 3: Shadow Branch -> Verified PR (Horizontal) */}
                                <path d="M 550 600 L 450 600" stroke="rgba(34, 211, 238, 0.1)" strokeWidth="2" fill="none" />
                                <motion.circle 
                                    cx="550" cy="600" r="3" fill="#22d3ee" filter="url(#glow)"
                                    animate={{ cx: [550, 450], opacity: [0, 1, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                />
                            </svg>
                        </div>

                        <div className="grid lg:grid-cols-2 gap-x-24 gap-y-12 relative z-10">
                            {/* Feature 1: Semantic RAG */}
                            <div className="glass-card p-10 bg-navy-900/40 border-white/5 text-left group overflow-hidden relative">
                                <div className="flex items-start justify-between mb-12">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-3">Semantic RAG Engine</h3>
                                        <p className="text-sm text-gray-500 max-w-xs">Traverses your entire repository using vector embeddings to identify the exact root cause.</p>
                                    </div>
                                    <div className="p-4 bg-heal-purple/10 rounded-2xl text-heal-purple">
                                        <Cpu className="w-8 h-8" />
                                    </div>
                                </div>

                                <div className="bg-black/40 rounded-xl p-4 font-mono text-[9px] text-gray-600 border border-white/5 relative h-40 overflow-hidden">
                                    <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-t from-navy-950 to-transparent z-10" />
                                    <div className="space-y-1 animate-scroll-vertical">
                                        <p className="text-heal-purple">Embedding: src/auth/provider.py ... [0.12, 0.44, 0.98]</p>
                                        <p className="text-heal-cyan">Scanning: src/auth/helper.py ... [MATCH 98.2%]</p>
                                        <p className="text-heal-purple">Ranking candidate: src/auth/helper.py (Confidence: High)</p>
                                        <p className="text-heal-cyan">Synthesizing context window... [4,096 tokens]</p>
                                    </div>
                                </div>
                            </div>

                            {/* Feature 2: Pedagogical Synthesis */}
                            <div className="glass-card p-10 bg-navy-900/40 border-white/5 text-left group overflow-hidden relative">
                                <div className="flex items-start justify-between mb-12">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-3">Pedagogical Synthesis</h3>
                                        <p className="text-sm text-gray-500 max-w-xs">AutoHeal doesn't just fix code—it teaches. Every PR includes a deep-dive analysis.</p>
                                    </div>
                                    <div className="p-4 bg-heal-cyan/10 rounded-2xl text-heal-cyan">
                                        <Bot className="w-8 h-8" />
                                    </div>
                                </div>

                                <div className="bg-black/40 rounded-xl p-6 border border-white/5 h-40 space-y-3">
                                    <div className="h-4 w-3/4 bg-white/5 rounded" />
                                    <div className="h-4 w-full bg-white/5 rounded" />
                                    <div className="text-[10px] font-mono text-gray-600 pl-4 py-2 border-l-2 border-heal-cyan/30 italic">
                                        "Updating relative import in line 14 to resolve dependency tree..."
                                    </div>
                                </div>
                            </div>

                            {/* Feature 4: Verified PR Automation (Reordered for flow) */}
                            <div className="glass-card p-10 bg-navy-900/40 border-white/5 text-left group overflow-hidden relative lg:order-last">
                                <div className="flex items-start justify-between mb-12">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-3">Secure PR Delivery</h3>
                                        <p className="text-sm text-gray-500 max-w-xs">Verified patches delivered via secure webhooks for full org compliance.</p>
                                    </div>
                                    <div className="p-4 bg-heal-red/10 rounded-2xl text-heal-red">
                                        <GitPullRequest className="w-8 h-8" />
                                    </div>
                                </div>

                                <div className="bg-black/40 rounded-xl p-6 flex items-center justify-center border border-white/5 h-40 gap-8">
                                    <div className="text-center">
                                        <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center mb-2">
                                            <Code2 className="w-4 h-4 text-gray-600" />
                                        </div>
                                        <p className="text-[8px] text-gray-600 font-bold uppercase tracking-tight font-mono">Origin</p>
                                    </div>
                                    <ArrowRight className="w-6 h-6 text-heal-red animate-pulse" />
                                    <div className="text-center">
                                        <div className="w-12 h-12 rounded-full bg-heal-red/20 border-2 border-heal-red/40 flex items-center justify-center mb-2 shadow-glow-red">
                                            <GitPullRequest className="w-6 h-6 text-heal-red" />
                                        </div>
                                        <p className="text-[8px] text-heal-red font-bold uppercase tracking-tight font-mono">Secure PR</p>
                                    </div>
                                </div>
                            </div>

                            {/* Feature 3: Shadow Branch Validation */}
                            <div className="glass-card p-10 bg-navy-900/40 border-white/5 text-left group overflow-hidden relative">
                                <div className="flex items-start justify-between mb-12">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-3">Shadow Branch Runtime</h3>
                                        <p className="text-sm text-gray-500 max-w-xs">Isolated Docker environment for every fix to ensure no regressions hit main.</p>
                                    </div>
                                    <div className="p-4 bg-heal-green/10 rounded-2xl text-heal-green">
                                        <Shield className="w-8 h-8" />
                                    </div>
                                </div>

                                <div className="bg-black/40 rounded-xl p-6 flex flex-col items-center justify-center border border-white/5 h-40 relative shadow-inner">
                                    <div className="flex gap-4">
                                        {[1, 2].map(i => (
                                            <div key={i} className="w-12 h-16 rounded-lg bg-navy-900 border border-white/10 flex flex-col items-center justify-center relative overflow-hidden group">
                                                <div className="w-2 h-2 rounded-full bg-heal-green animate-ping" />
                                                <span className="text-[7px] text-gray-600 font-mono mt-2">D_ENV_{i}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex items-center gap-4 w-full px-8">
                                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div animate={{ width: ['0%', '100%'] }} transition={{ duration: 2, repeat: Infinity }} className="h-full bg-heal-green" />
                                        </div>
                                        <span className="text-[9px] text-heal-green font-bold font-mono">STABLE</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </section>

            {/* Creative Floating CTA Section */}
            <section className="py-40 px-6 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-heal-cyan/10 blur-[150px] rounded-full -z-10" />

                <div className="max-w-4xl mx-auto">
                    <div className="glass-card bg-navy-900/20 border-white/10 p-16 md:p-24 rounded-[3rem] text-center shadow-3xl hover:border-white/20 transition-all duration-700">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter"
                        >
                            The Future of CI is <span className="gradient-text">Autonomous.</span>
                        </motion.h2>

                        <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                            Stop fixing bugs manually. Build a self-healing repository today.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                            <Link to="/login" className="w-full sm:w-auto px-12 py-5 bg-heal-cyan text-navy-950 font-black rounded-2xl hover:scale-105 transition-all shadow-glow-cyan">
                                START HEALING NOW
                            </Link>
                            <a href="#" className="w-full sm:w-auto px-12 py-5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/5 transition-all">
                                TECHNICAL DOCS
                            </a>
                        </div>

                        <div className="mt-16 flex justify-center gap-8 text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                            <span>Open Source Core</span>
                            <span>•</span>
                            <span>SOC-2 Compliant</span>
                            <span>•</span>
                            <span>99.9% Pipeline Health</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-white/5">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-3 opacity-50">
                        <Activity className="text-heal-cyan w-5 h-5" />
                        <span className="text-lg font-bold text-white tracking-tight">AutoHeal</span>
                    </div>
                    <p className="text-gray-500 text-sm">
                        © 2026 AutoHeal AI Systems. All rights reserved.
                    </p>
                    <div className="flex gap-6">
                        <a href="#" className="text-gray-500 hover:text-white transition-colors"><GitHubIcon className="w-5 h-5" /></a>
                        <a href="#" className="text-gray-500 hover:text-white transition-colors">Twitter</a>
                        <a href="#" className="text-gray-500 hover:text-white transition-colors">Docs</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
