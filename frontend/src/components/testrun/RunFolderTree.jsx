import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Package, Tag, Play, Plus, Trash2 } from 'lucide-react';
import useRunStore from '../../stores/useRunStore';
import useAppStore from '../../stores/useAppStore';

const RELEASE_STATUS_DOT = {
  planning: '#9ca3af',
  active: '#3b82f6',
  released: '#22c55e',
  archived: '#6b7280',
};

const FEATURE_STATUS_DOT = {
  requested: '#9ca3af',
  committed: '#3b82f6',
  in_progress: '#f59e0b',
  dev_complete: '#a855f7',
  in_testing: '#06b6d4',
  completed: '#22c55e',
  deferred: '#ef4444',
};

function TestRunNode({ run, releaseId }) {
  const navigate = useNavigate();
  const { selectedRunFolderId, selectTestRun, deleteTestRun } = useRunStore();
  const canEdit = useAppStore(s => s.isEditor());
  const isSelected = selectedRunFolderId === run.id;

  const handleDelete = (e) => {
    e.stopPropagation();
    if (!confirm('Delete test run "' + run.name + '"?')) return;
    deleteTestRun(run.id);
    navigate('/runs/release/' + releaseId);
  };

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer group select-none transition-colors ml-4"
      style={isSelected ? { background: '#dbeafe', color: '#0e2e5b' } : {}}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f0f5fc'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = ''; }}
      onClick={() => { navigate('/runs/release/' + releaseId + '/tr/' + run.id); selectTestRun(run.id, releaseId); }}
    >
      <Play size={11} style={{ color: '#1a56b0' }} className="shrink-0" />
      <span className="text-xs text-gray-700 truncate flex-1">{run.name}</span>
      {canEdit && (
        <button onClick={handleDelete} className="hidden group-hover:block shrink-0">
          <Trash2 size={12} className="text-gray-300 hover:text-red-500" />
        </button>
      )}
    </div>
  );
}

function FeatureNode({ feature, releaseId }) {
  const navigate = useNavigate();
  const { selectedReleaseId, selectedFeatureId, selectFeatureRun } = useRunStore();
  const isSelected = selectedReleaseId === releaseId && selectedFeatureId === feature.id;

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer select-none transition-colors ml-4"
      style={isSelected ? { background: '#dbeafe', color: '#0e2e5b' } : {}}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f0f5fc'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = ''; }}
      onClick={() => { navigate('/runs/release/' + releaseId + '/feature/' + feature.id); selectFeatureRun(releaseId, feature.id); }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: FEATURE_STATUS_DOT[feature.status] || '#9ca3af' }} />
      <Tag size={12} className="text-gray-400 shrink-0" />
      <span className="text-xs text-gray-700 truncate flex-1">{feature.name}</span>
      {feature.priority && (
        <span className="text-[10px] text-gray-400 shrink-0">{feature.priority}</span>
      )}
    </div>
  );
}

function ReleaseNode({ node, depth = 0 }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const { selectedReleaseId, selectedFeatureId, selectedRunFolderId, selectRelease, createTestRun } = useRunStore();
  const canEdit = useAppStore(s => s.isEditor());
  const isSelected = selectedReleaseId === node.id && !selectedFeatureId && !selectedRunFolderId;
  const hasChildren = (node.children?.length > 0) || (node.features?.length > 0) || (node.testRuns?.length > 0);

  const handleAddRun = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createTestRun(newName.trim(), node.id);
    setNewName('');
    setAdding(false);
    setOpen(true);
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer group select-none transition-colors"
        style={isSelected ? { background: '#dbeafe', color: '#0e2e5b' } : {}}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f0f5fc'; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = ''; }}
        onClick={() => { navigate('/runs/release/' + node.id); selectRelease(node.id); setOpen(true); }}
      >
        <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }} className="text-gray-400 hover:text-gray-600">
          {hasChildren
            ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
            : <span className="w-3.5 inline-block" />}
        </button>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: RELEASE_STATUS_DOT[node.status] || '#9ca3af' }} />
        <Package size={14} style={{ color: '#0e6856' }} className="shrink-0" />
        <span className="flex-1 text-sm truncate font-medium">{node.name}</span>
      </div>

      {open && (
        <div style={{ paddingLeft: 16 }}>
          {/* Sub-releases */}
          {node.children?.map(child => <ReleaseNode key={child.id} node={child} depth={depth + 1} />)}
          {/* Features */}
          {node.features?.map(f => <FeatureNode key={f.id} feature={f} releaseId={node.id} />)}
          {/* Named test runs */}
          {node.testRuns?.map(tr => <TestRunNode key={tr.id} run={tr} releaseId={node.id} />)}
          {/* Add test run button */}
          {canEdit && !adding && (
            <button
              onClick={e => { e.stopPropagation(); setAdding(true); }}
              className="flex items-center gap-1.5 px-2 py-1 ml-4 rounded text-xs transition-colors"
              style={{ color: '#1a56b0' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#e8f0fe'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; }}
            >
              <Plus size={12} /> Add Test Run
            </button>
          )}
          {canEdit && adding && (
            <form
              onSubmit={handleAddRun}
              className="flex items-center gap-1 px-2 py-1 ml-4"
              onClick={e => e.stopPropagation()}
              onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) { setAdding(false); setNewName(''); } }}
            >
              <input
                autoFocus
                className="flex-1 border border-gray-300 rounded px-2 py-0.5 text-xs"
                placeholder="Test run name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <button type="submit" className="text-xs font-medium" style={{ color: '#1a56b0' }}>Add</button>
              <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-400">&times;</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function RunFolderTree() {
  const { releaseTree, fetchReleaseTree } = useRunStore();

  useEffect(() => { fetchReleaseTree(); }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid #d0def4' }}>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#0e2e5b' }}>Releases</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {releaseTree.map(node => <ReleaseNode key={node.id} node={node} />)}
        {releaseTree.length === 0 && (
          <p className="text-xs text-gray-400 px-3 py-4 text-center">No releases yet. Create releases in the Releases tab.</p>
        )}
      </div>
    </div>
  );
}
