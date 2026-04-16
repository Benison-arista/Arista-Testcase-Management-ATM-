import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Trash2 } from 'lucide-react';
import useRunStore from '../../stores/useRunStore';
import useAppStore from '../../stores/useAppStore';

function RunFolderNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const { selectedRunFolderId, selectRunFolder, createRunFolder, deleteRunFolder } = useRunStore();
  const canManageRuns = useAppStore(s => s.isRunManager());

  const isSelected = selectedRunFolderId === node.id;

  const handleSelect = () => {
    selectRunFolder(node.id);
    setOpen(true);
  };

  const handleAddChild = async (e) => {
    e.stopPropagation();
    if (!newName.trim()) return;
    await createRunFolder(newName.trim(), node.id);
    setNewName(''); setAdding(false); setOpen(true);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete folder "${node.name}"?`)) return;
    await deleteRunFolder(node.id);
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer group select-none ${
          isSelected ? 'bg-purple-100 text-purple-800' : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleSelect}
      >
        <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }} className="text-gray-400 hover:text-gray-600">
          {node.children?.length > 0
            ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
            : <span className="w-3.5 inline-block" />}
        </button>
        {open ? <FolderOpen size={14} className="text-purple-500 shrink-0" />
               : <Folder size={14} className="text-purple-400 shrink-0" />}
        <span className="flex-1 text-sm truncate">{node.name}</span>
        {canManageRuns && (
          <span className="hidden group-hover:flex items-center gap-1">
            <button onClick={e => { e.stopPropagation(); setAdding(a => !a); }}><Plus size={13} className="text-gray-400 hover:text-purple-600" /></button>
            <button onClick={handleDelete}><Trash2 size={13} className="text-gray-400 hover:text-red-500" /></button>
          </span>
        )}
      </div>

      {open && (
        <div>
          {node.children?.map(child => <RunFolderNode key={child.id} node={child} depth={depth + 1} />)}
          {canManageRuns && adding && (
            <form onSubmit={handleAddChild} className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }} onClick={e => e.stopPropagation()}>
              <input autoFocus className="flex-1 border border-gray-300 rounded px-2 py-0.5 text-xs" placeholder="Folder name" value={newName} onChange={e => setNewName(e.target.value)} />
              <button type="submit" className="text-xs text-purple-600 font-medium">Add</button>
              <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-400">&times;</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function RunFolderTree() {
  const { runTree, fetchRunTree, createRunFolder } = useRunStore();
  const canManageRuns = useAppStore(s => s.isRunManager());
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => { fetchRunTree(); }, []);

  const handleAddRoot = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createRunFolder(newName.trim(), null);
    setNewName(''); setAdding(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Releases</span>
        {canManageRuns && <button onClick={() => setAdding(a => !a)}><Plus size={14} className="text-gray-400 hover:text-purple-600" /></button>}
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {runTree.map(node => <RunFolderNode key={node.id} node={node} />)}
        {canManageRuns && adding && (
          <form onSubmit={handleAddRoot} className="flex items-center gap-1 px-3 py-1">
            <input autoFocus className="flex-1 border border-gray-300 rounded px-2 py-0.5 text-xs" placeholder="Release name" value={newName} onChange={e => setNewName(e.target.value)} />
            <button type="submit" className="text-xs text-purple-600 font-medium">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-400">&times;</button>
          </form>
        )}
        {runTree.length === 0 && !adding && <p className="text-xs text-gray-400 px-3 py-4 text-center">No releases yet.</p>}
      </div>
    </div>
  );
}
