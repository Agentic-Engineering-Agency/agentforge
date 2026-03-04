/**
 * Dashboard Login Route
 *
 * Simple password-based login for dashboard protection.
 */

import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePassword = useQuery(api.auth.validatePassword, { password });
  const createSession = useMutation(api.auth.createSession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if auth is disabled via environment variable
      const authDisabled = (import.meta as any).env.VITE_AUTH_DISABLED === 'true';

      if (authDisabled) {
        // Dev mode: no password required
        localStorage.setItem('agentforge_session', 'dev-mode');
        navigate({ to: '/' });
        return;
      }

      // Validate password against Convex
      const result = await new Promise<{ valid: boolean }>((resolve, reject) => {
        // Refetch the validatePassword query with the current password
        validatePassword.refetch({ password }).then(resolve).catch(reject);
      });

      if (result.valid) {
        // Create a session and get token
        const sessionResult = await createSession();
        const token = sessionResult.token;

        // Store session in localStorage
        localStorage.setItem('agentforge_session', token);
        localStorage.setItem('agentforge_session_expires', String(sessionResult.expiresAt));

        // Redirect to dashboard
        navigate({ to: '/' });
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      console.error('Login error:', err);
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
