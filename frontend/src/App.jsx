import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import DashboardPage from './pages/DashboardPage';
import ReposPage from './pages/ReposPage';
import PipelinesListPage from './pages/PipelinesListPage';
import PipelinePage from './pages/PipelinePage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-heal-cyan/30 border-t-heal-cyan rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={
        <PublicRoute><LoginPage /></PublicRoute>
      } />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected */}
      <Route path="/app" element={
        <ProtectedRoute><Layout /></ProtectedRoute>
      }>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="repos" element={<ReposPage />} />
        <Route path="pipelines" element={<PipelinesListPage />} />
        <Route path="pipelines/:id" element={<PipelinePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Catch-all: If logged in, go to dashboard, else home */}
      <Route path="*" element={<Navigate to={user ? "/app/dashboard" : "/"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
