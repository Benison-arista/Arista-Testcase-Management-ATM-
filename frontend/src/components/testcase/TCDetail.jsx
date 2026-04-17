import { useState } from 'react';
import { Edit2, History, Trash2, X, Clock } from 'lucide-react';
import useTCStore from '../../stores/useTCStore';
import useAppStore from '../../stores/useAppStore';
import { getSchema } from '../../schemas';
import TCForm from './TCForm';
import TCTable from './TCTable';

// --- Priority / State badge colors ---
const BADGE_COLORS = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-green-100 text-green-700',
  Active: 'bg-green-100 text-green-700',
  Draft: 'bg-yellow-100 text-yellow-700',
  Deprecated: 'bg-gray-100 text-gray-500',
};

// Fields to show in the metadata grid (non-textarea, non-title)
const GRID_FIELDS = [
  'qtest_id', 'testrail_id', 'priority', 'state', 'module', 'section',
  'pillar', 'template', 'milestone', 'automatable_call', 'automation_status',
  'automated_by', 'blocked_by', 'customer_found', 'hardware_platforms',
  'jira_defect', 'arista_id', 'type', 'owner', 'status',
];

// Full-width content fields shown at the bottom in order
const FULL_WIDTH_FIELDS = ['description', 'precondition', 'test_steps', 'expected_result', 'comments'];

function MetadataValue({ field, value }) {
  if (value === undefined || value === null || value === '') return null;

  // Badge for priority and state
  if ((field.key === 'priority' || field.key === 'state' || field.key === 'status') && BADGE_COLORS[value]) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_COLORS[value]}`}>
        {value}
      </span>
    );
  }

  if (field.type === 'boolean') {
    return <span className="text-sm text-gray-800">{value ? 'Yes' : 'No'}</span>;
  }

  return <span className="text-sm text-gray-800">{String(value)}</span>;
}

// --- History Panel: renders each version in the same layout as TC detail view ---
function HistoryPanel({ history, section, onClose }) {
  const schema = getSchema(section);

  // Build a set of changed keys between this version and the previous one
  function getChangedKeys(current, previous) {
    if (!previous) return null; // first version — nothing to highlight
    const changed = new Set();
    const allKeys = new Set([...Object.keys(current || {}), ...Object.keys(previous || {})]);
    for (const key of allKeys) {
      const a = current?.[key] ?? '';
      const b = previous?.[key] ?? '';
      if (String(a) !== String(b)) changed.add(key);
    }
    return changed;
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full h-full max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '2px solid #d0def4' }}>
          <h3 style={{ color: '#0e2e5b' }} className="font-bold text-base flex items-center gap-2"><Clock size={18} /> Version History</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-2">
          {history.map((h, i) => {
            const versionNum = history.length - i;
            const isFirst = i === history.length - 1;
            const previous = isFirst ? null : history[i + 1]?.data;
            const changedKeys = getChangedKeys(h.data, previous);
            const data = h.data || {};
            const prevData = previous || {};
            const title = data.title || data.description || data.arista_id || '';

            return (
              <div key={h.id} className="py-4 px-4" style={{ borderBottom: '1px solid #d0def4' }}>
                {/* Version header */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                    style={isFirst
                      ? { background: '#d1fae5', color: '#047857' }
                      : { background: '#dbeafe', color: '#0e2e5b' }
                    }
                  >
                    v{versionNum}
                  </span>
                  <span className="text-xs text-gray-500">
                    {h.changed_by} &middot; {new Date(h.changed_at).toLocaleString()}
                  </span>
                  {isFirst && <span className="text-xs font-semibold" style={{ color: '#047857' }}>Created</span>}
                  {changedKeys && changedKeys.size > 0 && (
                    <span className="text-xs text-gray-400">
                      ({changedKeys.size} field{changedKeys.size !== 1 ? 's' : ''} changed)
                    </span>
                  )}
                </div>

                {isFirst ? (
                  /* --- v1 (Created): Show full TC in detail layout --- */
                  <>
                    {title && (
                      <h4 className="font-bold text-base mb-3" style={{ color: '#0e2e5b' }}>{title}</h4>
                    )}
                    {(() => {
                      const gridFields = GRID_FIELDS
                        .map(key => schema.find(f => f.key === key))
                        .filter(f => f && data[f.key] !== undefined && data[f.key] !== null && data[f.key] !== '');
                      const fullWidthFields = FULL_WIDTH_FIELDS
                        .map(key => schema.find(f => f.key === key))
                        .filter(f => f && data[f.key]);
                      return (
                        <>
                          {gridFields.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 mb-3">
                              {gridFields.map(field => (
                                <div key={field.key}>
                                  <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#1a56b0' }}>{field.label}</p>
                                  <MetadataValue field={field} value={data[field.key]} />
                                </div>
                              ))}
                            </div>
                          )}
                          {fullWidthFields.map(field => (
                            <div key={field.key} className="mt-3 pt-3" style={{ borderTop: '1px solid #e8f0fe' }}>
                              <h4 className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: '#0e2e5b' }}>{field.label}</h4>
                              <div className="text-sm text-gray-800 whitespace-pre-wrap rounded-lg p-3 leading-relaxed max-h-48 overflow-y-auto" style={{ background: '#f0f5fc' }}>
                                {String(data[field.key])}
                              </div>
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </>
                ) : changedKeys && changedKeys.size > 0 ? (
                  /* --- v2+: Show only changed fields with old → new --- */
                  <div className="space-y-3">
                    {[...changedKeys].map(key => {
                      const field = schema.find(f => f.key === key);
                      const label = field?.label || key;
                      const oldVal = prevData[key];
                      const newVal = data[key];
                      const oldStr = oldVal === undefined || oldVal === null ? '' : String(oldVal);
                      const newStr = newVal === undefined || newVal === null ? '' : String(newVal);
                      const isFullWidth = FULL_WIDTH_FIELDS.includes(key);

                      return (
                        <div key={key} className="rounded-lg p-3" style={{ background: '#fefce8', border: '1px solid #fde68a' }}>
                          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#92400e' }}>
                            {label}
                            {!oldStr && newStr && <span className="ml-2 font-normal italic text-gray-400">(added)</span>}
                            {oldStr && !newStr && <span className="ml-2 font-normal italic text-gray-400">(removed)</span>}
                          </p>
                          {isFullWidth ? (
                            /* Full-width fields: old and new side by side */
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs font-semibold text-gray-400 mb-1">Previous</p>
                                <div className="text-sm whitespace-pre-wrap rounded p-2 max-h-60 overflow-y-auto" style={{ background: '#fef2f2', color: '#991b1b' }}>
                                  {oldStr || <span className="italic text-gray-300">empty</span>}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold mb-1" style={{ color: '#166534' }}>Updated</p>
                                <div className="text-sm whitespace-pre-wrap rounded p-2 max-h-60 overflow-y-auto" style={{ background: '#f0fdf4', color: '#166534' }}>
                                  {newStr || <span className="italic text-gray-300">empty</span>}
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Grid fields: old → new inline */
                            <div className="flex items-center gap-2 text-sm flex-wrap">
                              {oldStr && (
                                <span className="px-2 py-0.5 rounded line-through" style={{ background: '#fef2f2', color: '#991b1b' }}>
                                  {oldStr}
                                </span>
                              )}
                              {oldStr && newStr && <span className="text-gray-400">→</span>}
                              {newStr && (
                                <span className="px-2 py-0.5 rounded font-medium" style={{ background: '#f0fdf4', color: '#166534' }}>
                                  {newStr}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No changes detected</p>
                )}
              </div>
            );
          })}
          {!history.length && <p className="text-sm text-gray-400 text-center py-8">No history yet.</p>}
        </div>
      </div>
    </div>
  );
}

// --- Main TC Detail ---
export default function TCDetail({ section }) {
  const { selectedTC, deleteTC, fetchHistory, history, clearTC } = useTCStore();
  const canEdit = useAppStore(s => s.isEditor());
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const schema = getSchema(section);

  if (!selectedTC) return <TCTable section={section} />;

  const data = selectedTC.data || {};
  const title = data.title || data.description || data.arista_id || `TC #${selectedTC.id}`;

  // Split fields into grid and full-width groups
  const gridFields = GRID_FIELDS
    .map(key => schema.find(f => f.key === key))
    .filter(f => f && data[f.key] !== undefined && data[f.key] !== null && data[f.key] !== '');

  const fullWidthFields = FULL_WIDTH_FIELDS
    .map(key => schema.find(f => f.key === key))
    .filter(f => f && data[f.key]);

  const handleDelete = async () => {
    if (!confirm('Delete this test case?')) return;
    await deleteTC(selectedTC.id);
  };

  const handleHistory = async () => {
    await fetchHistory(selectedTC.id);
    setShowHistory(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '2px solid #d0def4' }}>
        <div className="min-w-0 flex-1 mr-4">
          <h2 style={{ color: '#0e2e5b' }} className="font-bold text-lg leading-tight truncate">{title}</h2>
          <p className="text-xs text-gray-400 mt-1">
            Created by {selectedTC.created_by} &middot; {new Date(selectedTC.created_at).toLocaleDateString()}
            {selectedTC.last_edited_by && ` \u00b7 Edited by ${selectedTC.last_edited_by} on ${new Date(selectedTC.last_edited_at).toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleHistory} style={{ color: '#0e6856', borderColor: '#6ee7b7', background: '#ecfdf5' }} className="flex items-center gap-1 text-xs font-medium hover:opacity-80 border rounded px-2 py-1">
            <History size={13} /> History
          </button>
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
          <button onClick={clearTC} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Metadata grid */}
        {gridFields.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
            {gridFields.map(field => (
              <div key={field.key}>
                <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#1a56b0' }}>{field.label}</p>
                <MetadataValue field={field} value={data[field.key]} />
              </div>
            ))}
          </div>
        )}

        {/* Full-width content sections */}
        {fullWidthFields.map(field => (
          <div key={field.key} className="pt-4" style={{ borderTop: '1px solid #d0def4' }}>
            <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#0e2e5b' }}>{field.label}</h4>
            <div className="text-sm text-gray-800 whitespace-pre-wrap rounded-lg p-4 leading-relaxed" style={{ background: '#f0f5fc' }}>
              {String(data[field.key])}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <TCForm section={section} initial={selectedTC} onClose={() => setEditing(false)} />
      )}

      {showHistory && (
        <HistoryPanel history={history} section={section} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}
