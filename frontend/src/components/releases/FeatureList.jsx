import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import useReleaseStore from '../../stores/useReleaseStore';
import useAppStore from '../../stores/useAppStore';
import Pagination from '../common/Pagination';
import FeatureForm from './FeatureForm';

const STATUS_STYLE = {
  requested:    { bg: '#f3f4f6', color: '#374151', label: 'Requested', rowBg: '#fafafa' },
  committed:    { bg: '#dbeafe', color: '#1e40af', label: 'Committed', rowBg: '#eff6ff' },
  in_progress:  { bg: '#fef3c7', color: '#92400e', label: 'In Progress', rowBg: '#fffbeb' },
  dev_complete: { bg: '#e9d5ff', color: '#6b21a8', label: 'Dev Complete', rowBg: '#faf5ff' },
  in_testing:   { bg: '#cffafe', color: '#0e7490', label: 'In Testing', rowBg: '#ecfeff' },
  completed:    { bg: '#d1fae5', color: '#065f46', label: 'Completed', rowBg: '#f0fdf4' },
  deferred:     { bg: '#fee2e2', color: '#991b1b', label: 'Deferred', rowBg: '#fef2f2' },
};

const PRIORITY_STYLE = {
  P0: { bg: '#fee2e2', color: '#991b1b' },
  P1: { bg: '#ffedd5', color: '#9a3412' },
  P2: { bg: '#fef9c3', color: '#854d0e' },
  P3: { bg: '#f3f4f6', color: '#374151' },
};

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function rfeId(id) {
  return 'RFE-' + String(id).padStart(4, '0');
}

export default function FeatureList() {
  const navigate = useNavigate();
  const { features, selectedReleaseId, selectedFeature, selectFeature, summary, page, totalPages, total, setPage } = useReleaseStore();
  const canEdit = useAppStore(s => s.isEditor());
  const [showForm, setShowForm] = useState(false);

  if (!selectedReleaseId) return (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
      Select a release to view features.
    </div>
  );

  const handleSelect = (feature) => {
    selectFeature(feature);
    navigate('/releases/' + selectedReleaseId + '/feature/' + feature.id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #d0def4', background: '#f0f5fc' }}>
        <div>
          <span className="text-sm font-medium" style={{ color: '#0e2e5b' }}>{total || features.length} feature{(total || features.length) !== 1 ? 's' : ''}</span>
          {summary && (
            <span className="ml-3 text-xs text-gray-400">
              {summary.completed || 0} done &middot; {summary.in_progress || 0} in progress &middot; {summary.requested || 0} requested
            </span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm(true)}
            style={{ color: '#0e6856', borderColor: '#6ee7b7', background: '#ecfdf5' }}
            className="flex items-center gap-1 text-xs font-semibold border rounded px-2.5 py-1.5 hover:opacity-85"
          >
            <Plus size={13} /> Add Feature
          </button>
        )}
      </div>

      {/* Summary bar */}
      {summary && summary.total > 0 && (
        <div className="flex h-2 shrink-0" title={`${summary.completed} completed, ${summary.in_testing} testing, ${summary.in_progress} in progress, ${summary.committed} committed, ${summary.requested} requested`}>
          {summary.completed > 0 && <div style={{ width: (summary.completed / summary.total * 100) + '%', background: '#22c55e' }} />}
          {summary.in_testing > 0 && <div style={{ width: (summary.in_testing / summary.total * 100) + '%', background: '#06b6d4' }} />}
          {summary.dev_complete > 0 && <div style={{ width: (summary.dev_complete / summary.total * 100) + '%', background: '#a855f7' }} />}
          {summary.in_progress > 0 && <div style={{ width: (summary.in_progress / summary.total * 100) + '%', background: '#f59e0b' }} />}
          {summary.committed > 0 && <div style={{ width: (summary.committed / summary.total * 100) + '%', background: '#3b82f6' }} />}
          {summary.requested > 0 && <div style={{ width: (summary.requested / summary.total * 100) + '%', background: '#9ca3af' }} />}
          {summary.deferred > 0 && <div style={{ width: (summary.deferred / summary.total * 100) + '%', background: '#ef4444' }} />}
        </div>
      )}

      {/* Feature table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10" style={{ background: '#e8f0fe', boxShadow: '0 1px 0 0 #d0def4' }}>
            <tr>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">ID</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Feature</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Priority</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Dev</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">QA</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">PM</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Jira</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Target</th>
            </tr>
          </thead>
          <tbody>
            {features.map(f => {
              const st = STATUS_STYLE[f.status] || STATUS_STYLE.requested;
              const pr = PRIORITY_STYLE[f.priority];
              const isActive = selectedFeature?.id === f.id;
              return (
                <tr
                  key={f.id}
                  onClick={() => handleSelect(f)}
                  className="cursor-pointer transition-colors border-b"
                  style={{
                    background: isActive ? '#dbeafe' : st.rowBg,
                    borderLeft: isActive ? '3px solid #1a56b0' : '3px solid ' + st.bg,
                    borderBottomColor: '#e5e7eb',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#e0eaf7'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? '#dbeafe' : st.rowBg; }}
                >
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-xs font-mono font-semibold" style={{ color: '#1a56b0' }}>{rfeId(f.id)}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-gray-800 truncate max-w-xs">{f.name}</p>
                    {f.description && <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{f.description}</p>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {pr ? (
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: pr.bg, color: pr.color }}>{f.priority}</span>
                    ) : (
                      <span className="text-xs text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{f.dev_assignee || <span className="text-gray-300">&mdash;</span>}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{f.qa_assignee || <span className="text-gray-300">&mdash;</span>}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{f.pm || <span className="text-gray-300">&mdash;</span>}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {f.jira_id ? <span className="font-mono" style={{ color: '#1a56b0' }}>{f.jira_id}</span> : <span className="text-gray-300">&mdash;</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{formatDate(f.target_date) || <span className="text-gray-300">&mdash;</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!features.length && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <p className="text-sm">No features in this release yet.</p>
            {canEdit && (
              <button onClick={() => setShowForm(true)} className="text-xs underline" style={{ color: '#0e6856' }}>Add a feature</button>
            )}
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      {showForm && <FeatureForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
