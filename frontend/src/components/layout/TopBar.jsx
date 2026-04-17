import { useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, X, LogOut, Shield } from 'lucide-react';
import useAppStore from '../../stores/useAppStore';
import useSearchStore from '../../stores/useSearchStore';
import atmLogo from '../../assets/atm-logo.png';

const TABS = [
  { key: 'velocloud', label: 'VeloCloud TCs' },
  { key: 'arista',    label: 'Arista TCs' },
  { key: 'runs',      label: 'Test Runs' },
];

const ROLE_LABEL = {
  viewer: 'Viewer',
  editor: 'Editor',
  run_manager: 'Run Manager',
};

const ROLE_COLORS = {
  viewer: { bg: '#6b7280', border: '#9ca3af' },
  editor: { bg: '#1a56b0', border: '#3d8bfd' },
  run_manager: { bg: '#d97706', border: '#fbbf24' },
};

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAppStore();
  const { query, search, clearSearch } = useSearchStore();
  const searchTimeout = useRef(null);
  const inputRef = useRef(null);

  // Derive active tab from URL path
  const path = location.pathname;
  const activeTab = path.startsWith('/arista') ? 'arista' : path.startsWith('/runs') ? 'runs' : 'velocloud';

  const handleSearch = useCallback((e) => {
    const q = e.target.value;
    clearTimeout(searchTimeout.current);
    if (!q) { clearSearch(); return; }
    if (activeTab === 'runs') return;
    searchTimeout.current = setTimeout(() => {
      search(q, activeTab);
    }, 300);
    useSearchStore.setState({ query: q });
  }, [activeTab, search, clearSearch]);

  const handleClear = useCallback(() => {
    clearSearch();
    if (inputRef.current) inputRef.current.value = '';
    inputRef.current?.focus();
  }, [clearSearch]);

  const handleTabClick = (key) => {
    clearSearch();
    if (inputRef.current) inputRef.current.value = '';
    navigate('/' + key);
  };

  const roleColor = ROLE_COLORS[user?.role] || ROLE_COLORS.viewer;

  return (
    <header
      style={{ background: 'linear-gradient(135deg, #0e2e5b 0%, #1a3a6b 50%, #1a56b0 100%)' }}
      className="flex items-center gap-4 px-5 h-14 shrink-0 shadow-lg"
    >
      {/* Brand logo */}
      <a onClick={() => navigate('/velocloud')} className="shrink-0 flex items-center rounded-md overflow-hidden cursor-pointer" title="ATM - Arista Testcase Management" style={{ background: '#fff', padding: '2px 6px' }}>
        <img src={atmLogo} alt="ATM" className="h-9" />
      </a>

      {/* Tabs */}
      <nav className="flex gap-1 ml-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTabClick(t.key)}
            style={activeTab === t.key
              ? { background: '#3d8bfd', color: '#fff' }
              : {}
            }
            className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition-all ${
              activeTab === t.key
                ? 'shadow-md'
                : 'text-blue-100 hover:bg-white/15'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Search */}
      {activeTab !== 'runs' && (
        <div className="flex-1 max-w-md relative ml-4">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-200" />
          <input
            ref={inputRef}
            style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' }}
            className="w-full border rounded-lg pl-8 pr-8 py-1.5 text-sm text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/20"
            placeholder="Search by ID or keyword..."
            defaultValue={query}
            onChange={handleSearch}
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-200 hover:text-white p-0.5 rounded-full hover:bg-white/20"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        {/* Role badge */}
        <span
          style={{ backgroundColor: roleColor.bg, borderColor: roleColor.border }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white border"
        >
          <Shield size={12} />
          {ROLE_LABEL[user?.role] || 'Viewer'}
        </span>

        {/* User name */}
        <span className="text-sm text-blue-100 font-medium">{user?.username}</span>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign out"
          className="p-1.5 text-blue-200 hover:text-white hover:bg-white/15 rounded-md transition-colors"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
