export const ARISTA_SCHEMA = [
  { key: 'arista_id',   label: 'ID',          type: 'text',     required: true },
  { key: 'description', label: 'Description', type: 'textarea', required: true },
  { key: 'status',      label: 'Status',      type: 'select',   options: ['Active', 'Draft', 'Deprecated'] },
  { key: 'type',        label: 'Type',        type: 'text' },
  { key: 'priority',    label: 'Priority',    type: 'select',   options: ['P1', 'P2', 'P3'] },
  { key: 'owner',       label: 'Owner',       type: 'text' },
  { key: 'comments',    label: 'Comments',    type: 'textarea' },
];

// Key used for exact-ID search
export const ARISTA_ID_KEY = 'arista_id';
