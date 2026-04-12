import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  FolderGit2,
  Activity,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/repos', icon: FolderGit2, label: 'Repositories' },
  { path: '/pipelines', icon: Activity, label: 'Pipelines' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen z-40 flex flex-col
      bg-navy-800/80 backdrop-blur-xl border-r border-white/5
      transition-all duration-300 ease-in-out
      ${collapsed ? 'w-20' : 'w-64'}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-heal-gradient flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold gradient-text whitespace-nowrap">AutoHeal</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Self-Healing CI/CD</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
              ${isActive
                ? 'bg-heal-gradient/10 text-heal-cyan border border-heal-cyan/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }
              ${collapsed ? 'justify-center' : ''}`
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-white/5">
        {user && (
          <div className={`flex items-center gap-3 px-3 py-3 rounded-xl
            ${collapsed ? 'justify-center' : ''}`}
          >
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-8 h-8 rounded-full ring-2 ring-heal-cyan/30 flex-shrink-0"
            />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{user.displayName || user.username}</p>
                <p className="text-xs text-gray-500 truncate">@{user.username}</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full px-3 py-2.5 mt-1
            text-gray-400 hover:text-red-400 rounded-xl transition-all duration-200 hover:bg-red-500/10
            ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-navy-700 border border-white/10
          flex items-center justify-center text-gray-400 hover:text-heal-cyan hover:border-heal-cyan/30
          transition-all duration-200 z-50"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
