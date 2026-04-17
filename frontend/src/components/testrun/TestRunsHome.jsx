import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Calendar } from 'lucide-react';
import useRunStore from '../../stores/useRunStore';
import { getReleasesOverview } from '../../api/releases';

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

function ReleaseRunCard({ release, onClick }) {
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
          {release.feature_count > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{release.feature_count} feature{release.feature_count !== 1 ? 's' : ''}</p>
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

      {/* Test execution */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Execution</span>
          <span className="text-xs text-gray-500">{executed}/{release.total_tcs} executed ({execPct}%)</span>
        </div>
        <ProgressBar
          pass={release.pass_count}
          fail={release.fail_count}
          blocked={release.blocked_count}
          total={release.total_tcs}
        />
        <div className="flex gap-3 mt-2">
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
          <span className="text-xs font-medium ml-auto" style={{ color: passPct >= 80 ? '#22c55e' : passPct >= 50 ? '#f59e0b' : '#ef4444' }}>
            {passPct}% pass
          </span>
        </div>
      </div>
    </div>
  );
}

export default function TestRunsHome() {
  const navigate = useNavigate();
  const { selectRelease } = useRunStore();
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getReleasesOverview();
        if (!cancelled) setReleases(data);
      } catch (err) {
        console.error('Failed to fetch test runs overview:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Only show root releases that have test cases
  const rootReleases = releases.filter(r => !r.parent_id);
  const releasesWithRuns = rootReleases.filter(r => r.total_tcs > 0);
  const releasesWithoutRuns = rootReleases.filter(r => r.total_tcs === 0);

  // Aggregate stats across all releases
  const totalTCs = releases.reduce((s, r) => s + r.total_tcs, 0);
  const totalPass = releases.reduce((s, r) => s + r.pass_count, 0);
  const totalFail = releases.reduce((s, r) => s + r.fail_count, 0);
  const totalBlocked = releases.reduce((s, r) => s + r.blocked_count, 0);
  const totalPending = releases.reduce((s, r) => s + r.pending_count, 0);
  const totalExecuted = totalPass + totalFail + totalBlocked;
  const overallExecRate = totalTCs > 0 ? Math.round((totalExecuted / totalTCs) * 100) : 0;
  const overallPassRate = totalTCs > 0 ? Math.round((totalPass / totalTCs) * 100) : 0;
  const activeReleases = releases.filter(r => r.total_tcs > 0).length;

  const handleCardClick = (release) => {
    selectRelease(release.id);
    navigate('/runs/release/' + release.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Loading test runs...</p>
      </div>
    );
  }

  if (releases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <Play size={40} className="text-gray-300" />
        <p className="text-sm text-gray-400">No releases yet</p>
        <p className="text-xs text-gray-300">Create releases in the Releases tab to start tracking test runs</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 shrink-0" style={{ borderBottom: '2px solid #d0def4', background: '#f8fafd' }}>
        <div className="flex items-center gap-2">
          <Play size={20} style={{ color: '#1a56b0' }} />
          <h1 style={{ color: '#0e2e5b' }} className="text-xl font-bold">Test Runs</h1>
        </div>
        <p className="text-xs text-gray-500 mt-1">Test execution across {activeReleases} release{activeReleases !== 1 ? 's' : ''} &middot; {totalTCs} total test cases</p>
      </div>

      {/* Aggregate Stats */}
      <div className="px-6 py-5 shrink-0" style={{ borderBottom: '1px solid #d0def4' }}>
        <h2 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#0e2e5b' }}>Overall Execution</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <StatCard value={activeReleases} label="Releases" />
          <StatCard value={totalTCs} label="Total TCs" />
          <StatCard value={totalPass} label="Passed" color="#22c55e" bg="#f0fdf4" />
          <StatCard value={totalFail} label="Failed" color="#ef4444" bg="#fef2f2" />
          <StatCard value={totalBlocked} label="Blocked" color="#f59e0b" bg="#fffbeb" />
          <StatCard value={totalPending} label="Pending" color="#6b7280" bg="#f9fafb" />
          <StatCard value={overallExecRate + '%'} label="Execution" color="#1a56b0" bg="#e8f0fe" />
          <StatCard value={overallPassRate + '%'} label="Pass Rate" color={overallPassRate >= 80 ? '#22c55e' : overallPassRate >= 50 ? '#f59e0b' : '#ef4444'} bg={overallPassRate >= 80 ? '#f0fdf4' : overallPassRate >= 50 ? '#fffbeb' : '#fef2f2'} />
        </div>
        {/* Overall progress bar */}
        {totalTCs > 0 && (
          <div className="mt-4">
            <ProgressBar pass={totalPass} fail={totalFail} blocked={totalBlocked} total={totalTCs} />
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: RUN_STATUS_COLORS.pass }} /><span className="text-xs text-gray-500">Pass: {totalPass}</span></div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: RUN_STATUS_COLORS.fail }} /><span className="text-xs text-gray-500">Fail: {totalFail}</span></div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: RUN_STATUS_COLORS.blocked }} /><span className="text-xs text-gray-500">Blocked: {totalBlocked}</span></div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: RUN_STATUS_COLORS.pending }} /><span className="text-xs text-gray-500">Pending: {totalPending}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Release Cards with active test runs */}
      <div className="px-6 py-5 flex-1">
        {releasesWithRuns.length > 0 && (
          <>
            <h2 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#0e2e5b' }}>
              Active Test Execution ({releasesWithRuns.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {releasesWithRuns.map(release => (
                <ReleaseRunCard key={release.id} release={release} onClick={() => handleCardClick(release)} />
              ))}
            </div>
          </>
        )}

        {releasesWithoutRuns.length > 0 && (
          <div className={releasesWithRuns.length > 0 ? 'mt-6' : ''}>
            <h2 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#9ca3af' }}>
              No Test Runs Yet ({releasesWithoutRuns.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {releasesWithoutRuns.map(release => {
                const st = RELEASE_STATUS[release.status] || RELEASE_STATUS.planning;
                return (
                  <div
                    key={release.id}
                    className="rounded-lg p-4 cursor-pointer transition-shadow hover:shadow-md"
                    style={{ border: '1px dashed #d0def4', background: '#fafbfd' }}
                    onClick={() => handleCardClick(release)}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-500 truncate">{release.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{release.feature_count} feature{release.feature_count !== 1 ? 's' : ''} &middot; No test cases added</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
