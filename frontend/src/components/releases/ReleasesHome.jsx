import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Calendar, CheckCircle2 } from 'lucide-react';
import useReleaseStore from '../../stores/useReleaseStore';

const RELEASE_STATUS = {
  planning: { bg: '#f3f4f6', color: '#374151', label: 'Planning' },
  active:   { bg: '#dbeafe', color: '#1e40af', label: 'Active' },
  released: { bg: '#d1fae5', color: '#065f46', label: 'Released' },
  archived: { bg: '#e5e7eb', color: '#6b7280', label: 'Archived' },
};

const RUN_STATUS_COLORS = { pass: '#22c55e', fail: '#ef4444', blocked: '#f59e0b', pending: '#d1d5db' };

function StatCard({ value, label, color, bg }) {
  return (
    <div className="rounded-lg p-4 text-center" style={{ background: bg || '#f0f5fc' }}>
      <p className="text-2xl font-bold" style={{ color: color || '#0e2e5b' }}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function ProgressBar({ pass, fail, blocked, total }) {
  if (total === 0) return <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-200" />;
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-200">
      {pass > 0 && <div style={{ width: (pass / total * 100) + '%', background: RUN_STATUS_COLORS.pass }} />}
      {fail > 0 && <div style={{ width: (fail / total * 100) + '%', background: RUN_STATUS_COLORS.fail }} />}
      {blocked > 0 && <div style={{ width: (blocked / total * 100) + '%', background: RUN_STATUS_COLORS.blocked }} />}
    </div>
  );
}

function FeatureBar({ completed, total }) {
  if (total === 0) return <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-gray-200" />;
  const pct = (completed / total * 100);
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-gray-200">
      <div style={{ width: pct + '%', background: '#22c55e' }} />
    </div>
  );
}

function ReleaseCard({ release, onClick }) {
  const st = RELEASE_STATUS[release.status] || RELEASE_STATUS.planning;
  const executed = release.pass_count + release.fail_count + release.blocked_count;
  const execPct = release.total_tcs > 0 ? Math.round((executed / release.total_tcs) * 100) : 0;
  const passPct = release.total_tcs > 0 ? Math.round((release.pass_count / release.total_tcs) * 100) : 0;

  return (
    <div
      className="rounded-lg p-5 cursor-pointer transition-shadow hover:shadow-lg"
      style={{ border: '1px solid #d0def4', background: 'white' }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold truncate" style={{ color: '#0e2e5b' }}>{release.name}</h3>
          {release.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{release.description}</p>
          )}
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2"
          style={{ background: st.bg, color: st.color }}
        >
          {st.label}
        </span>
      </div>

      {/* Target date */}
      {release.target_date && (
        <div className="flex items-center gap-1 mb-3">
          <Calendar size={12} className="text-gray-400" />
          <span className="text-xs text-gray-500">Target: {new Date(release.target_date).toLocaleDateString()}</span>
        </div>
      )}

      {/* Feature progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Features</span>
          <span className="text-xs text-gray-500">{release.features_completed}/{release.feature_count} completed</span>
        </div>
        <FeatureBar completed={release.features_completed} total={release.feature_count} />
      </div>

      {/* Test execution */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Test Execution</span>
          <span className="text-xs text-gray-500">{execPct}% executed</span>
        </div>
        <ProgressBar
          pass={release.pass_count}
          fail={release.fail_count}
          blocked={release.blocked_count}
          pending={release.pending_count}
          total={release.total_tcs}
        />
        {release.total_tcs > 0 && (
          <div className="flex gap-3 mt-1.5">
            <span className="text-xs text-gray-400">{release.total_tcs} TCs</span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: RUN_STATUS_COLORS.pass }} />
              <span className="text-xs text-gray-500">{release.pass_count}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: RUN_STATUS_COLORS.fail }} />
              <span className="text-xs text-gray-500">{release.fail_count}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: RUN_STATUS_COLORS.blocked }} />
              <span className="text-xs text-gray-500">{release.blocked_count}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: RUN_STATUS_COLORS.pending }} />
              <span className="text-xs text-gray-500">{release.pending_count}</span>
            </div>
          </div>
        )}
        {release.total_tcs > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <CheckCircle2 size={12} className="text-green-500" />
            <span className="text-xs font-medium" style={{ color: passPct >= 80 ? '#22c55e' : passPct >= 50 ? '#f59e0b' : '#ef4444' }}>
              {passPct}% pass rate
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReleasesHome() {
  const navigate = useNavigate();
  const { overview, overviewLoading, fetchOverview, selectRelease } = useReleaseStore();

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const rootReleases = overview.filter(r => !r.parent_id);

  // Aggregate stats across all releases
  const totalReleases = overview.length;
  const activeReleases = overview.filter(r => r.status === 'active').length;
  const totalFeatures = overview.reduce((s, r) => s + r.feature_count, 0);
  const totalFeaturesCompleted = overview.reduce((s, r) => s + r.features_completed, 0);
  const totalTCs = overview.reduce((s, r) => s + r.total_tcs, 0);
  const totalPass = overview.reduce((s, r) => s + r.pass_count, 0);
  const totalFail = overview.reduce((s, r) => s + r.fail_count, 0);
  const totalBlocked = overview.reduce((s, r) => s + r.blocked_count, 0);
  const totalExecuted = totalPass + totalFail + totalBlocked;
  const overallPassRate = totalTCs > 0 ? Math.round((totalPass / totalTCs) * 100) : 0;
  const overallExecRate = totalTCs > 0 ? Math.round((totalExecuted / totalTCs) * 100) : 0;

  const handleCardClick = (release) => {
    selectRelease(release.id);
    navigate('/releases/' + release.id);
  };

  if (overviewLoading && overview.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Loading releases...</p>
      </div>
    );
  }

  if (!overviewLoading && overview.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <Layers size={40} className="text-gray-300" />
        <p className="text-sm text-gray-400">No releases yet</p>
        <p className="text-xs text-gray-300">Create a release from the sidebar to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 shrink-0" style={{ borderBottom: '2px solid #d0def4', background: '#f8fafd' }}>
        <div className="flex items-center gap-2">
          <Layers size={20} style={{ color: '#1a56b0' }} />
          <h1 style={{ color: '#0e2e5b' }} className="text-xl font-bold">Releases</h1>
        </div>
        <p className="text-xs text-gray-500 mt-1">{totalReleases} release{totalReleases !== 1 ? 's' : ''} across the project</p>
      </div>

      {/* Aggregate Stats */}
      <div className="px-6 py-5 shrink-0" style={{ borderBottom: '1px solid #d0def4' }}>
        <h2 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#0e2e5b' }}>Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <StatCard value={totalReleases} label="Total Releases" />
          <StatCard value={activeReleases} label="Active" color="#3b82f6" bg="#eff6ff" />
          <StatCard value={totalFeatures} label="Total Features" />
          <StatCard value={totalFeaturesCompleted} label="Completed" color="#22c55e" bg="#f0fdf4" />
          <StatCard value={totalTCs} label="Total TCs" />
          <StatCard value={overallExecRate + '%'} label="Execution" color="#1a56b0" bg="#e8f0fe" />
          <StatCard value={overallPassRate + '%'} label="Pass Rate" color={overallPassRate >= 80 ? '#22c55e' : overallPassRate >= 50 ? '#f59e0b' : '#ef4444'} bg={overallPassRate >= 80 ? '#f0fdf4' : overallPassRate >= 50 ? '#fffbeb' : '#fef2f2'} />
          <StatCard value={totalFail} label="Failed TCs" color="#ef4444" bg="#fef2f2" />
        </div>
      </div>

      {/* Release Cards */}
      <div className="px-6 py-5 flex-1">
        <h2 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#0e2e5b' }}>
          All Releases ({rootReleases.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rootReleases.map(release => (
            <ReleaseCard key={release.id} release={release} onClick={() => handleCardClick(release)} />
          ))}
        </div>
      </div>
    </div>
  );
}
