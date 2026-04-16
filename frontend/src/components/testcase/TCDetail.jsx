import { useState } from 'react';
import { Edit2, History, Trash2, X, Clock } from 'lucide-react';
import useTCStore from '../../stores/useTCStore';
import useAppStore from '../../stores/useAppStore';
import { getSchema } from '../../schemas';
import { DynamicFieldDisplay } from './DynamicField';
import TCForm from './TCForm';
import TCTable from './TCTable';

function HistoryPanel({ history, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Clock size={16} /> Version History</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {history.map((h, i) => (
            <div key={h.id} className="px-5 py-3">
              <p className="text-xs text-gray-500 mb-1">
                <span className="font-medium text-gray-700">v{history.length - i}</span>
                {' · '}{h.changed_by}{' · '}{new Date(h.changed_at).toLocaleString()}
              </p>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded p-2 max-h-40 overflow-y-auto">
                {JSON.stringify(h.data, null, 2)}
              </pre>
            </div>
          ))}
          {!history.length && <p className="text-sm text-gray-400 text-center py-8">No history yet.</p>}
        </div>
      </div>
    </div>
  );
}

export default function TCDetail({ section }) {
  const { selectedTC, deleteTC, fetchHistory, history, clearTC } = useTCStore();
  const canEdit = useAppStore(s => s.isEditor());
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const schema = getSchema(section);

  if (!selectedTC) return <TCTable section={section} />;

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
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-gray-900 text-base">
            {selectedTC.data.title || selectedTC.data.description || selectedTC.data.arista_id || `TC #${selectedTC.id}`}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Created by {selectedTC.created_by} · {new Date(selectedTC.created_at).toLocaleDateString()}
            {selectedTC.last_edited_by && ` · Edited by ${selectedTC.last_edited_by} on ${new Date(selectedTC.last_edited_at).toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleHistory} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1">
            <History size={13} /> History
          </button>
          {canEdit && (
            <>
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1">
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

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <dl>
          {schema.map(field => (
            <DynamicFieldDisplay key={field.key} field={field} value={selectedTC.data[field.key]} />
          ))}
        </dl>
      </div>

      {editing && (
        <TCForm
          section={section}
          initial={selectedTC}
          onClose={() => setEditing(false)}
        />
      )}

      {showHistory && (
        <HistoryPanel history={history} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}
