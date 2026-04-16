import { useState } from 'react';
import useAppStore from '../../stores/useAppStore';

export default function UserPrompt() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAppStore(s => s.login);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ background: 'linear-gradient(135deg, #0e2e5b 0%, #1a56b0 50%, #3d8bfd 100%)' }}
      className="fixed inset-0 flex items-center justify-center z-50"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm flex flex-col gap-5"
        style={{ borderTop: '4px solid #3d8bfd' }}
      >
        <div>
          <h2 style={{ color: '#0e2e5b' }} className="text-2xl font-extrabold tracking-tight">ATM</h2>
          <p className="text-sm text-gray-500 mt-1">Arista Testcase Management</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <input
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': '#3d8bfd' }}
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': '#3d8bfd' }}
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={!username.trim() || !password || loading}
          style={{ background: loading ? '#9ca3af' : '#1a56b0' }}
          className="text-white rounded-lg py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
