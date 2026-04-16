// Read-only display of a single dynamic field
export function DynamicFieldDisplay({ field, value }) {
  if (value === undefined || value === null || value === '') return null;

  const display = field.type === 'boolean'
    ? (value ? 'Yes' : 'No')
    : String(value);

  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-100 last:border-0">
      <dt className="text-xs font-medium text-gray-500 col-span-1">{field.label}</dt>
      <dd className={`col-span-2 text-sm text-gray-800 ${field.type === 'textarea' ? 'whitespace-pre-wrap' : ''}`}>
        {display}
      </dd>
    </div>
  );
}

// Editable input for a single dynamic field
export function DynamicFieldInput({ field, value, onChange }) {
  const base = 'w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-arista-400';

  if (field.type === 'textarea') {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <textarea
          className={`${base} min-h-[80px] resize-y`}
          value={value || ''}
          onChange={e => onChange(field.key, e.target.value)}
          required={field.required}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <select
          className={base}
          value={value || ''}
          onChange={e => onChange(field.key, e.target.value)}
        >
          <option value="">— select —</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={field.key}
          checked={!!value}
          onChange={e => onChange(field.key, e.target.checked)}
          className="w-4 h-4 accent-arista-500"
        />
        <label htmlFor={field.key} className="text-sm text-gray-700">{field.label}</label>
      </div>
    );
  }

  // text (default)
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">
        {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        className={base}
        value={value || ''}
        onChange={e => onChange(field.key, e.target.value)}
        required={field.required}
      />
    </div>
  );
}
