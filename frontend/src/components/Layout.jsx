import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-navy-900">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <main className={`transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-64'}`}>
        {/* Subtle gradient header bar */}
        <div className="h-1 bg-heal-gradient opacity-60" />

        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
