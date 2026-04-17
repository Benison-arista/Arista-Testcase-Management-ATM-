import { useState } from 'react';
import { X } from 'lucide-react';
import useTCStore from '../../stores/useTCStore';
import useFolderStore from '../../stores/useFolderStore';
import { getSchema } from '../../schemas';
import { DynamicFieldInput } from './DynamicField';

// Same grouping as TCDetail view
const FULL_WIDTH_FIELDS = ['description', 'precondition', 'test_steps', 'expected_result', 'comments'];

export default function TCForm({ section, initial = null, onClose }) {
  const schema = getSchema(section);
  const { createTC, updateTC } = useTCStore();
  const { selectedFolderId } = useFolderStore();

  const [formData, setFormData] = useState(initial?.data || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (initial) {
        await updateTC(initial.id, { data: formData, version: initial.version });
      } else {
        await createTC({ folder_id: selectedFolderId, section, data: formData });
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const gridFields = schema.filter(f => !FULL_WIDTH_FIELDS.includes(f.key));
  const fullWidthFields = schema.filter(f => FULL_WIDTH_FIELDS.includes(f.key));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-6" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl flex flex-col w-full h-full max-w-[90vw] max-h-[90vh]"
      >
        {/* Header — matching history panel style */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '2px solid #d0def4' }}>
          <h3 style={{ color: '#0e2e5b' }} className="font-bold text-base">
            {initial ? 'Edit Test Case' : 'New Test Case'}
          </h3>
          <button type="button" onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Grid fields — 3 columns for short fields */}
          {gridFields.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {gridFields.map(field => (
                <div key={field.key}>
                  <DynamicFieldInput field={field} value={formData[field.key]} onChange={handleChange} />
                </div>
              ))}
            </div>
          )}

          {/* Full-width textarea fields */}
          {fullWidthFields.map(field => (
            <div key={field.key} className="pt-3" style={{ borderTop: '1px solid #d0def4' }}>
              <DynamicFieldInput field={field} value={formData[field.key]} onChange={handleChange} />
            </div>
          ))}
        </div>

        {error && <p className="px-6 py-2 text-sm text-red-600">{error}</p>}

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3 shrink-0" style={{ borderTop: '2px solid #d0def4' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{ background: saving ? '#9ca3af' : '#1a56b0' }}
            className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all font-semibold"
          >
            {saving ? 'Saving...' : (initial ? 'Save Changes' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
}
