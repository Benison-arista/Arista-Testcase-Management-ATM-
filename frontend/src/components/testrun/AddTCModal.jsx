import { useState } from 'react';
import { X, Search, Plus } from 'lucide-react';
import { searchTestcases, listTestcases } from '../../api/testcases';
import useRunStore from '../../stores/useRunStore';

export default function AddTCModal({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const { addRunItem } = useRunStore();

  const handleSearch = async (e) => {
    const q = e.target.value;
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const rows = await searchTestcases({ q });
      setResults(rows);
    } finally { setLoading(false); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    for (const id of selected) { await addRunItem(id); }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Add Test Cases to Run</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="px-5 py-3 border-b">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-arista-400"
              placeholder="Search by ID or keyword…"
              value={query}
              onChange={handleSearch}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {loading && <p className="text-sm text-gray-400 text-center py-6">Searching…</p>}
          {!loading && !results.length && query && (
            <p className="text-sm text-gray-400 text-center py-6">No results.</p>
          )}
          {results.map(tc => {
            const title = tc.data.title || tc.data.description || `TC #${tc.id}`;
            const id = tc.data.qtest_id || tc.data.arista_id || tc.id;
            return (
              <label key={tc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(tc.id)}
                  onChange={() => toggleSelect(tc.id)}
                  className="w-4 h-4 accent-arista-500"
                />
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{title}</p>
                  <p className="text-xs text-gray-400">{id} · {tc.section}</p>
                </div>
              </label>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t flex justify-between items-center">
          <span className="text-xs text-gray-500">{selected.size} selected</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={!selected.size}
              className="px-4 py-2 text-sm bg-arista-500 text-white rounded-lg hover:bg-arista-600 disabled:opacity-40 flex items-center gap-1"
            >
              <Plus size={14} /> Add {selected.size > 0 ? selected.size : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
