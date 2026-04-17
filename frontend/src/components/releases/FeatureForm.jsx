import { useState } from 'react';
import { X } from 'lucide-react';
import useReleaseStore from '../../stores/useReleaseStore';

const STATUS_OPTIONS = ['requested', 'committed', 'in_progress', 'dev_complete', 'in_testing', 'completed', 'deferred'];
const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'];

const FIELDS = [
  { key: 'name', label: 'Feature Name', type: 'text', required: true },
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
  { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
  { key: 'jira_id', label: 'Jira ID', type: 'text' },
  { key: 'dev_assignee', label: 'Dev Assignee', type: 'text' },
  { key: 'qa_assignee', label: 'QA Assignee', type: 'text' },
  { key: 'pm', label: 'PM', type: 'text' },
  { key: 'target_date', label: 'Target Date', type: 'date' },
  { key: 'dev_eta', label: 'Dev ETA', type: 'date' },
  { key: 'qa_eta', label: 'QA ETA', type: 'date' },
  { key: 'tags', label: 'Tags', type: 'text' },
];

const TEXTAREA_FIELDS = [
  { key: 'description', label: 'Description' },
  { key: 'notes', label: 'Notes' },
];

export default function FeatureForm({ initial = null, onClose }) {
  const { createFeature, updateFeature } = useReleaseStore();
  const [form, setForm] = useState(() => {
    if (initial) {
      const f = { ...initial };
      // Format dates for input[type=date]
      ['target_date', 'dev_eta', 'qa_eta'].forEach(k => {
        if (f[k]) f[k] = f[k].split('T')[0];
      });
      return f;
    }
    return {};
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name?.trim()) { setError('Feature name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (initial) {
        await updateFeature(initial.id, { ...form, version: initial.version });
      } else {
        await createFeature(form);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const base = 'w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-6" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl flex flex-col w-full h-full max-w-[90vw] max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '2px solid #d0def4' }}>
          <h3 style={{ color: '#0e2e5b' }} className="font-bold text-base">
            {initial ? 'Edit Feature' : 'New Feature'}
          </h3>
          <button type="button" onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Grid fields */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {FIELDS.map(field => (
              <div key={field.key}>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {field.type === 'select' ? (
                  <select className={base} value={form[field.key] || ''} onChange={e => set(field.key, e.target.value)} style={{ '--tw-ring-color': '#3d8bfd' }}>
                    <option value="">-- select --</option>
                    {field.options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    className={base}
                    value={form[field.key] || ''}
                    onChange={e => set(field.key, e.target.value)}
                    required={field.required}
                    style={{ '--tw-ring-color': '#3d8bfd' }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Textarea fields */}
          {TEXTAREA_FIELDS.map(field => (
            <div key={field.key} className="pt-3" style={{ borderTop: '1px solid #d0def4' }}>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{field.label}</label>
              <textarea
                className={base + ' min-h-[100px] resize-y'}
                value={form[field.key] || ''}
                onChange={e => set(field.key, e.target.value)}
                style={{ '--tw-ring-color': '#3d8bfd' }}
              />
            </div>
          ))}
        </div>

        {error && <p className="px-6 py-2 text-sm text-red-600">{error}</p>}

        <div className="px-6 py-4 flex justify-end gap-3 shrink-0" style={{ borderTop: '2px solid #d0def4' }}>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{ background: saving ? '#9ca3af' : '#1a56b0' }}
            className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all font-semibold"
          >
            {saving ? 'Saving...' : (initial ? 'Save Changes' : 'Create Feature')}
          </button>
        </div>
      </form>
    </div>
  );
}
