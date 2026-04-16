import { useRef, useCallback } from 'react';
import { Search, LogOut, Shield } from 'lucide-react';
import useAppStore from '../../stores/useAppStore';
import useSearchStore from '../../stores/useSearchStore';

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

const ROLE_STYLE = {
  viewer: 'text-gray-500 border-gray-200 bg-gray-50',
  editor: 'text-blue-600 border-blue-200 bg-blue-50',
  run_manager: 'text-amber-700 border-amber-300 bg-amber-50',
};

export default function TopBar() {
  const { activeTab, setActiveTab, user, logout } = useAppStore();
  const { query, search, clearSearch } = useSearchStore();
  const searchTimeout = useRef(null);

  const handleSearch = useCallback((e) => {
    const q = e.target.value;
    clearTimeout(searchTimeout.current);
    if (!q) { clearSearch(); return; }
    if (activeTab === 'runs') return;
    searchTimeout.current = setTimeout(() => {
      search(q, activeTab);
    }, 300);
    // Update query immediately for input responsiveness
    useSearchStore.setState({ query: q });
  }, [activeTab, search, clearSearch]);

  return (
    <header className="bg-white border-b border-gray-200 flex items-center gap-4 px-4 h-14 shrink-0">
      {/* Brand */}
      <span className="font-bold text-blue-700 text-lg whitespace-nowrap">ATM</span>

      {/* Tabs */}
      <nav className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); clearSearch(); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Search */}
      {activeTab !== 'runs' && (
        <div className="flex-1 max-w-md relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Search by ID or keyword..."
            defaultValue={query}
            onChange={handleSearch}
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        {/* Role badge */}
        <span className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border ${ROLE_STYLE[user?.role] || ROLE_STYLE.viewer}`}>
          <Shield size={13} />
          {ROLE_LABEL[user?.role] || 'Viewer'}
        </span>

        {/* User name */}
        <span className="text-xs text-gray-500">{user?.username}</span>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign out"
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
