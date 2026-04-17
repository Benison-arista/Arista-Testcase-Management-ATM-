import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Package, Plus, Trash2, Edit2 } from 'lucide-react';
import useReleaseStore from '../../stores/useReleaseStore';
import useAppStore from '../../stores/useAppStore';

const STATUS_DOT = {
  planning: '#9ca3af',
  active: '#3b82f6',
  released: '#22c55e',
  archived: '#6b7280',
};

const STATUSES = ['planning', 'active', 'released', 'archived'];
const STATUS_LABEL = { planning: 'Planning', active: 'Active', released: 'Released', archived: 'Archived' };

function ReleaseNode({ node, depth = 0 }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [editStatus, setEditStatus] = useState(node.status || 'planning');
  const { selectedReleaseId, selectRelease, deleteRelease, createFeature, updateRelease } = useReleaseStore();
  const canManage = useAppStore(s => s.isRunManager());

  const isSelected = selectedReleaseId === node.id;

  const handleSelect = () => {
    navigate('/releases/' + node.id);
    selectRelease(node.id);
    setOpen(true);
  };

  const handleAdd = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setNewName('');
    setAdding(false);
    try {
      await createFeature({ name: trimmed }, node.id);
      await selectRelease(node.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create feature');
    }
    setOpen(true);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm('Delete release "' + node.name + '" and all its features?')) return;
    await deleteRelease(node.id);
    navigate('/releases');
  };

  const startEditing = (e) => {
    e.stopPropagation();
    setEditName(node.name);
    setEditStatus(node.status || 'planning');
    setEditing(true);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      await updateRelease(node.id, { name: trimmed, status: editStatus });
      setEditing(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update release');
    }
  };

  const cancelEditing = (e) => {
    if (e) e.stopPropagation();
    setEditing(false);
    setEditName(node.name);
    setEditStatus(node.status || 'planning');
  };

  if (editing) {
    return (
      <div>
        <form
          onSubmit={handleEditSave}
          className="flex flex-col gap-1.5 px-2 py-2 mx-1 rounded-lg"
          style={{ background: '#e8f0fe', border: '1px solid #a1bde9' }}
          onClick={e => e.stopPropagation()}
        >
          <input
            autoFocus
            className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
            placeholder="Release name"
            value={editName}
            onChange={e => setEditName(e.target.value)}
          />
          <select
            className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
            value={editStatus}
            onChange={e => setEditStatus(e.target.value)}
          >
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <button type="submit" className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: '#1a56b0', color: 'white' }}>Save</button>
            <button type="button" onClick={cancelEditing} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </form>
        {open && (
          <div style={{ paddingLeft: 16 }}>
            {node.children?.map(child => <ReleaseNode key={child.id} node={child} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer group select-none transition-colors"
        style={isSelected ? { background: '#dbeafe', color: '#0e2e5b' } : {}}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f0f5fc'; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = ''; }}
        onClick={handleSelect}
      >
        <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }} className="text-gray-400 hover:text-gray-600">
          {node.children?.length > 0
            ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
            : <span className="w-3.5 inline-block" />}
        </button>

        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_DOT[node.status] || '#9ca3af' }} />
        <Package size={14} style={{ color: '#0e6856' }} className="shrink-0" />
        <span className="flex-1 text-sm truncate" style={{ paddingLeft: depth > 0 ? 0 : 0 }}>{node.name}</span>

        {canManage && (
          <span className="hidden group-hover:flex items-center gap-1">
            <button onClick={startEditing}><Edit2 size={13} className="text-gray-400 hover:text-blue-500" /></button>
            <button onClick={e => { e.stopPropagation(); setAdding(a => !a); }}><Plus size={13} className="text-gray-400 hover:text-green-600" /></button>
            <button onClick={handleDelete}><Trash2 size={13} className="text-gray-400 hover:text-red-500" /></button>
          </span>
        )}
      </div>

      {open && (
        <div style={{ paddingLeft: 16 }}>
          {node.children?.map(child => <ReleaseNode key={child.id} node={child} depth={depth + 1} />)}
          {canManage && adding && (
            <form
              onSubmit={handleAdd}
              className="flex items-center gap-1 px-2 py-1"
              onClick={e => e.stopPropagation()}
              onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) { setAdding(false); setNewName(''); } }}
            >
              <input autoFocus className="flex-1 border border-gray-300 rounded px-2 py-0.5 text-xs" placeholder="Feature name" value={newName} onChange={e => setNewName(e.target.value)} />
              <button type="submit" className="text-xs font-medium" style={{ color: '#0e6856' }}>Add</button>
              <button type="button" onClick={() => { setAdding(false); setNewName(''); }} className="text-xs text-gray-400">&times;</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReleaseTree() {
  const { tree, fetchTree, createRelease } = useReleaseStore();
  const canManage = useAppStore(s => s.isRunManager());
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => { fetchTree(); }, []);

  const handleAddRoot = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createRelease(newName.trim(), null);
    setNewName(''); setAdding(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid #d0def4' }}>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#0e2e5b' }}>Releases</span>
        {canManage && <button onClick={() => setAdding(a => !a)}><Plus size={14} className="text-gray-400 hover:text-green-600" /></button>}
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tree.map(node => <ReleaseNode key={node.id} node={node} />)}
        {canManage && adding && (
          <form onSubmit={handleAddRoot} className="flex items-center gap-1 px-3 py-1">
            <input autoFocus className="flex-1 border border-gray-300 rounded px-2 py-0.5 text-xs" placeholder="Release name" value={newName} onChange={e => setNewName(e.target.value)} />
            <button type="submit" className="text-xs font-medium" style={{ color: '#0e6856' }}>Add</button>
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-400">&times;</button>
          </form>
        )}
        {tree.length === 0 && !adding && <p className="text-xs text-gray-400 px-3 py-4 text-center">No releases yet.</p>}
      </div>
    </div>
  );
}
