export const VELOCLOUD_SCHEMA = [
  { key: 'title',              label: 'Title',              type: 'text',     required: true },
  { key: 'qtest_id',           label: 'qTest ID',           type: 'text' },
  { key: 'description',        label: 'Description',        type: 'textarea' },
  { key: 'precondition',       label: 'Precondition',       type: 'textarea' },
  { key: 'test_steps',         label: 'Test Steps',         type: 'textarea' },
  { key: 'expected_result',    label: 'Expected Result',    type: 'textarea' },
  { key: 'priority',           label: 'Priority',           type: 'select',  options: ['P1', 'P2', 'P3'] },
  { key: 'testrail_id',        label: 'TestRail ID',        type: 'text' },
  { key: 'automatable_call',   label: 'Automatable Call',   type: 'select',  options: ['Yes', 'No'] },
  { key: 'automated_by',       label: 'Automated By',       type: 'text' },
  { key: 'automation_status',  label: 'Automation Status',  type: 'text' },
  { key: 'blocked_by',         label: 'Blocked By',         type: 'text' },
  { key: 'customer_found',     label: 'Customer Found',     type: 'boolean' },
  { key: 'milestone',          label: 'Milestone',          type: 'text' },
  { key: 'module',             label: 'Module',             type: 'text' },
  { key: 'jira_defect',        label: 'Jira Defect',        type: 'text' },
  { key: 'section',            label: 'Section',            type: 'text' },
  { key: 'template',           label: 'Template',           type: 'text' },
  { key: 'hardware_platforms', label: 'Hardware Platforms', type: 'text' },
  { key: 'pillar',             label: 'Pillar',             type: 'text' },
  { key: 'state',              label: 'State',              type: 'select',  options: ['Active', 'Draft', 'Deprecated'] },
];

// Key used for exact-ID search
export const VELOCLOUD_ID_KEY = 'qtest_id';
