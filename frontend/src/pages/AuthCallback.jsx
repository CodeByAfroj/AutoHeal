import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      login(token);
      navigate('/app/dashboard', { replace: true });
    } else {
      navigate('/login?error=no_token', { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-heal-cyan/30 border-t-heal-cyan rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Authenticating...</p>
      </div>
    </div>
  );
}
