import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, Trash2, X } from 'lucide-react';
import useReleaseStore from '../../stores/useReleaseStore';
import useAppStore from '../../stores/useAppStore';
import FeatureForm from './FeatureForm';

const STATUS_STYLE = {
  requested:    { bg: '#f3f4f6', color: '#374151', label: 'Requested' },
  committed:    { bg: '#dbeafe', color: '#1e40af', label: 'Committed' },
  in_progress:  { bg: '#fef3c7', color: '#92400e', label: 'In Progress' },
  dev_complete: { bg: '#e9d5ff', color: '#6b21a8', label: 'Dev Complete' },
  in_testing:   { bg: '#cffafe', color: '#0e7490', label: 'In Testing' },
  completed:    { bg: '#d1fae5', color: '#065f46', label: 'Completed' },
  deferred:     { bg: '#fee2e2', color: '#991b1b', label: 'Deferred' },
};

const PRIORITY_STYLE = {
  P0: { bg: '#fee2e2', color: '#991b1b' },
  P1: { bg: '#ffedd5', color: '#9a3412' },
  P2: { bg: '#fef9c3', color: '#854d0e' },
  P3: { bg: '#f3f4f6', color: '#374151' },
};

const GRID_FIELDS = [
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'jira_id', label: 'Jira ID' },
  { key: 'dev_assignee', label: 'Dev Assignee' },
  { key: 'qa_assignee', label: 'QA Assignee' },
  { key: 'pm', label: 'PM' },
  { key: 'target_date', label: 'Target Date' },
  { key: 'dev_eta', label: 'Dev ETA' },
  { key: 'qa_eta', label: 'QA ETA' },
  { key: 'tags', label: 'Tags' },
  { key: 'created_by', label: 'Created By' },
  { key: 'created_at', label: 'Created' },
];

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString();
}

export default function FeatureDetail() {
  const navigate = useNavigate();
  const { selectedFeature, selectedReleaseId, deleteFeature, clearFeature } = useReleaseStore();
  const canEdit = useAppStore(s => s.isEditor());
  const [editing, setEditing] = useState(false);

  if (!selectedFeature) return null;

  const f = selectedFeature;
  const st = STATUS_STYLE[f.status] || STATUS_STYLE.requested;
  const pr = PRIORITY_STYLE[f.priority];

  const handleDelete = async () => {
    if (!confirm('Delete feature "' + f.name + '"?')) return;
    await deleteFeature(f.id);
    navigate('/releases/' + selectedReleaseId);
  };

  const handleClose = () => {
    clearFeature();
    navigate('/releases/' + selectedReleaseId);
  };

  const getValue = (key) => {
    const val = f[key];
    if (val === null || val === undefined || val === '') return null;
    if (key === 'created_at' || key === 'target_date' || key === 'dev_eta' || key === 'qa_eta') return formatDate(val);
    if (key === 'status') {
      const s = STATUS_STYLE[val] || {};
      return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>{s.label || val}</span>;
    }
    if (key === 'priority' && PRIORITY_STYLE[val]) {
      const p = PRIORITY_STYLE[val];
      return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: p.bg, color: p.color }}>{val}</span>;
    }
    return String(val);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '2px solid #d0def4' }}>
        <div className="min-w-0 flex-1 mr-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0" style={{ background: '#e8f0fe', color: '#1a56b0' }}>RFE-{String(f.id).padStart(4, '0')}</span>
            <h2 style={{ color: '#0e2e5b' }} className="font-bold text-lg leading-tight truncate">{f.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Created by {f.created_by} &middot; {formatDate(f.created_at)}
            {f.updated_at && ' \u00b7 Updated ' + formatDate(f.updated_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <>
              <button onClick={() => setEditing(true)} style={{ color: '#1a56b0', borderColor: '#a1bde9' }} className="flex items-center gap-1 text-xs font-medium hover:opacity-80 border rounded px-2 py-1">
                <Edit2 size={13} /> Edit
              </button>
              <button onClick={handleDelete} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1">
                <Trash2 size={13} /> Delete
              </button>
            </>
          )}
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Metadata grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
          {GRID_FIELDS.map(({ key, label }) => {
            const val = getValue(key);
            if (val === null) return null;
            return (
              <div key={key}>
                <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#1a56b0' }}>{label}</p>
                <div className="text-sm text-gray-800">{val}</div>
              </div>
            );
          })}
        </div>

        {/* Description */}
        {f.description && (
          <div className="pt-4" style={{ borderTop: '1px solid #d0def4' }}>
            <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#0e2e5b' }}>Description</h4>
            <div className="text-sm text-gray-800 whitespace-pre-wrap rounded-lg p-4 leading-relaxed" style={{ background: '#f0f5fc' }}>
              {f.description}
            </div>
          </div>
        )}

        {/* Notes */}
        {f.notes && (
          <div className="pt-4" style={{ borderTop: '1px solid #d0def4' }}>
            <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#0e2e5b' }}>Notes</h4>
            <div className="text-sm text-gray-800 whitespace-pre-wrap rounded-lg p-4 leading-relaxed" style={{ background: '#f0f5fc' }}>
              {f.notes}
            </div>
          </div>
        )}
      </div>

      {editing && <FeatureForm initial={f} onClose={() => setEditing(false)} />}
    </div>
  );
}
