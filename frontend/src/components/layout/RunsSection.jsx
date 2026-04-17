import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import RunFolderTree from '../testrun/RunFolderTree';
import RunItemList from '../testrun/RunItemList';
import useRunStore from '../../stores/useRunStore';

export default function RunsSection() {
  const { releaseId, runId, featureId } = useParams();
  const { selectedReleaseId, selectRelease, selectTestRun, selectFeatureRun } = useRunStore();

  // Sync URL to state
  useEffect(() => {
    const rid = releaseId ? parseInt(releaseId, 10) : null;
    const trid = runId ? parseInt(runId, 10) : null;
    const fid = featureId ? parseInt(featureId, 10) : null;

    if (rid && trid) {
      selectTestRun(trid, rid);
    } else if (rid && fid) {
      selectFeatureRun(rid, fid);
    } else if (rid && rid !== selectedReleaseId) {
      selectRelease(rid);
    }
  }, [releaseId, runId, featureId]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-56 flex flex-col shrink-0 overflow-hidden" style={{ background: '#f0f5fc' }}>
        <RunFolderTree />
      </aside>
      <main className="flex-1 overflow-hidden flex flex-col bg-white">
        <RunItemList />
      </main>
    </div>
  );
}
