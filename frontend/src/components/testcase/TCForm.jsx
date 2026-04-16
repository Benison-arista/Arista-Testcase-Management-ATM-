import { useState } from 'react';
import { X } from 'lucide-react';
import useTCStore from '../../stores/useTCStore';
import useFolderStore from '../../stores/useFolderStore';
import { getSchema } from '../../schemas';
import { DynamicFieldInput } from './DynamicField';

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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">
            {initial ? 'Edit Test Case' : 'New Test Case'}
          </h3>
          <button type="button" onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 grid grid-cols-2 gap-4">
          {schema.map(field => (
            <div key={field.key} className={field.type === 'textarea' ? 'col-span-2' : ''}>
              <DynamicFieldInput field={field} value={formData[field.key]} onChange={handleChange} />
            </div>
          ))}
        </div>

        {error && <p className="px-5 py-2 text-sm text-red-600">{error}</p>}

        <div className="px-5 py-4 border-t flex justify-end gap-3">
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
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : (initial ? 'Save Changes' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
}
