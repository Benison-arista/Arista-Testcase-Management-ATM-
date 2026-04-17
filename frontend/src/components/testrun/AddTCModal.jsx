import { useState, useEffect, useRef } from 'react';
import { X, Search, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { searchTestcases } from '../../api/testcases';
import { getFolderTree } from '../../api/folders';
import { getTCsByFolder } from '../../api/runs';
import useRunStore from '../../stores/useRunStore';

function buildTree(flat) {
  const map = {};
  flat.forEach(n => { map[n.id] = { ...n, children: [] }; });
  const roots = [];
  flat.forEach(n => {
    if (n.parent_id && map[n.parent_id]) map[n.parent_id].children.push(map[n.id]);
    else if (!n.parent_id) roots.push(map[n.id]);
  });
  return roots;
}

function FolderPickerNode({ node, selectedFolders, onToggle, depth = 0 }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer hover:bg-gray-50 text-sm" style={{ paddingLeft: 8 + depth * 16 }}>
        <button onClick={() => setOpen(o => !o)} className="text-gray-400">
          {node.children?.length > 0 ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span className="w-3 inline-block" />}
        </button>
        <input type="checkbox" checked={selectedFolders.has(node.id)} onChange={() => onToggle(node.id)} className="accent-arista-500" />
        <Folder size={13} className="text-gray-400 shrink-0" />
        <span className="truncate text-gray-700">{node.name}</span>
      </div>
      {open && node.children?.map(c => <FolderPickerNode key={c.id} node={c} selectedFolders={selectedFolders} onToggle={onToggle} depth={depth + 1} />)}
    </div>
  );
}

export default function AddTCModal({ onClose }) {
  const { addRunItems } = useRunStore();
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [folderTree, setFolderTree] = useState([]);
  const [selectedFolders, setSelectedFolders] = useState(new Set());
  const [folderTCs, setFolderTCs] = useState([]); // TCs loaded from selected folders (shown in right panel)
  const [loadingFolders, setLoadingFolders] = useState(false);
  const searchTimeout = useRef(null);

  useEffect(() => { getFolderTree('velocloud').then(flat => setFolderTree(buildTree(flat))); }, []);

  const handleSearch = (q) => {
    setQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchTestcases({ q, limit: 100 });
        setSearchResults(res.data || res);
      } catch { setSearchResults([]); }
      setLoading(false);
    }, 300);
  };

  const toggleId = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = (items) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      const allSel = items.every(tc => n.has(tc.id));
      items.forEach(tc => allSel ? n.delete(tc.id) : n.add(tc.id));
      return n;
    });
  };

  const toggleFolder = async (folderId) => {
    const next = new Set(selectedFolders);
    if (next.has(folderId)) {
      next.delete(folderId);
      // Remove TCs from this folder from the right panel (and deselect them)
      setFolderTCs(prev => {
        const removed = prev.filter(tc => tc._folderId === folderId);
        removed.forEach(tc => setSelectedIds(p => { const n = new Set(p); n.delete(tc.id); return n; }));
        return prev.filter(tc => tc._folderId !== folderId);
      });
    } else {
      next.add(folderId);
      setLoadingFolders(true);
      try {
        const tcs = await getTCsByFolder({ folder_id: folderId });
        // Tag TCs with which folder loaded them, add to right panel without auto-selecting
        const tagged = tcs.map(tc => ({ ...tc, _folderId: folderId }));
        setFolderTCs(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          return [...prev, ...tagged.filter(t => !existingIds.has(t.id))];
        });
      } catch {}
      setLoadingFolders(false);
    }
    setSelectedFolders(next);
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setAdding(true);
    try { await addRunItems([...selectedIds]); onClose(); }
    catch (err) { alert(err.response?.data?.error || 'Failed to add'); }
    setAdding(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full h-full max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '2px solid #d0def4' }}>
          <h3 style={{ color: '#0e2e5b' }} className="font-bold text-base">Add Test Cases to Run</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0" style={{ borderColor: '#d0def4' }}>
          <button onClick={() => setTab('search')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'search' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
            <Search size={14} className="inline mr-1.5" />Search TCs
          </button>
          <button onClick={() => setTab('folder')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'folder' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
            <Folder size={14} className="inline mr-1.5" />Select by Folder
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left — search or folder picker */}
          <div className="w-80 border-r flex flex-col shrink-0 overflow-hidden" style={{ borderColor: '#d0def4' }}>
            {tab === 'search' ? (
              <div className="flex flex-col h-full">
                <div className="p-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Search by ID or keyword..." value={query} onChange={e => handleSearch(e.target.value)} autoFocus />
                  </div>
                </div>
                <div className="px-3 flex-1">
                  {loading && <p className="text-xs text-gray-400 text-center py-4">Searching...</p>}
                  {!loading && query && searchResults.length > 0 && <p className="text-xs text-gray-400 py-1">{searchResults.length} results found. Select from the right panel.</p>}
                  {!loading && query && searchResults.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No results.</p>}
                  {!query && <p className="text-xs text-gray-400 text-center py-4">Type to search for test cases.</p>}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto py-1">
                <p className="px-3 py-1.5 text-xs text-gray-400">Select folders to load TCs:</p>
                {folderTree.map(node => <FolderPickerNode key={node.id} node={node} selectedFolders={selectedFolders} onToggle={toggleFolder} />)}
                {loadingFolders && <p className="text-xs text-gray-400 text-center py-2">Loading TCs...</p>}
              </div>
            )}
          </div>

          {/* Right — all loaded TCs with checkboxes */}
          <div className="flex-1 flex flex-col min-w-0">
            {(() => {
              // Merge search results and folder TCs, deduplicate by id
              const allMap = new Map();
              searchResults.forEach(tc => allMap.set(tc.id, tc));
              folderTCs.forEach(tc => { if (!allMap.has(tc.id)) allMap.set(tc.id, tc); });
              const allItems = [...allMap.values()];

              return (
                <>
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100" style={{ background: '#f0f5fc' }}>
                    <span className="text-xs font-semibold" style={{ color: '#0e2e5b' }}>
                      {selectedIds.size} selected out of {allItems.length} test case{allItems.length !== 1 ? 's' : ''}
                    </span>
                    {allItems.length > 0 && (
                      <button onClick={() => toggleAll(allItems)} className="text-xs text-blue-600 hover:underline">
                        {allItems.every(tc => selectedIds.has(tc.id)) ? 'Deselect all' : 'Select all'}
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {allItems.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-8">
                        Search for test cases or select folders to see them here.
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {allItems.map(tc => (
                          <label key={tc.id} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                            <input type="checkbox" checked={selectedIds.has(tc.id)} onChange={() => toggleId(tc.id)} className="accent-arista-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-gray-800 truncate">{tc.data?.title || tc.data?.description || ''}</p>
                              <p className="text-xs text-gray-400">{tc.data?.qtest_id || tc.data?.arista_id || tc.id} &middot; {tc.section}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end gap-3 shrink-0" style={{ borderTop: '2px solid #d0def4' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleAdd} disabled={selectedIds.size === 0 || adding} style={{ background: adding ? '#9ca3af' : '#1a56b0' }} className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-semibold">
            {adding ? 'Adding...' : `Add ${selectedIds.size} TC${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
