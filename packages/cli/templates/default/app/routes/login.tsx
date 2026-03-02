/**
 * Dashboard Login Route
 *
 * Simple password-based login for dashboard protection.
 */

import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';

export default function LoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // For now, check environment variable
      // TODO: Call Convex auth:validatePassword mutation
      const envPassword = (import.meta as any).env.VITE_AGENTFORGE_PASSWORD;

      if (envPassword && password === envPassword) {
        // Store session in localStorage
        const token = `sess_${crypto.randomUUID().replace(/-/g, '')}`;
        localStorage.setItem('agentforge_session', token);
        localStorage.setItem('agentforge_session_expires', String(Date.now() + 24 * 60 * 60 * 1000));

        // Redirect to dashboard
        navigate({ to: '/' });
      } else if (!envPassword) {
        // No password set - allow access for local dev
        localStorage.setItem('agentforge_session', 'dev-mode');
        navigate({ to: '/' });
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-center">AgentForge</h1>
          <p className="mt-2 text-center text-gray-600">
            Sign in to access your dashboard
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="text-center text-sm text-gray-500">
            <p>To set a password, run:</p>
            <code className="mt-1 block bg-gray-100 px-2 py-1 rounded">
              agentforge auth set-password &lt;your-password&gt;
            </code>
          </div>
        </form>
      </div>
    </div>
  );
}
