import { create } from 'zustand';
import * as api from '../api/runs';
import { addRunItem as legacyAddRunItem } from '../api/runs';

function buildReleaseTree(releases, features, testRuns) {
  const map = {};
  releases.forEach(r => { map[r.id] = { ...r, type: 'release', children: [], features: [], testRuns: [] }; });

  features.forEach(f => {
    if (map[f.release_id]) {
      map[f.release_id].features.push({ ...f, type: 'feature' });
    }
  });

  // Attach named test runs to their release
  (testRuns || []).forEach(tr => {
    if (map[tr.release_id]) {
      map[tr.release_id].testRuns.push({ ...tr, type: 'testrun' });
    }
  });

  const roots = [];
  releases.forEach(r => {
    if (r.parent_id && map[r.parent_id]) {
      map[r.parent_id].children.push(map[r.id]);
    } else if (!r.parent_id) {
      roots.push(map[r.id]);
    }
  });
  return roots;
}

const useRunStore = create((set, get) => ({
  releaseTree: [],
  selectedReleaseId: null,
  selectedFeatureId: null,
  selectedRunFolderId: null, // named test run folder
  runItems: [],
  summary: null,
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,

  fetchReleaseTree: async () => {
    const { releases, features } = await api.getReleasesTree();
    // Load test runs for all releases
    const allManualRuns = [];
    for (const r of releases) {
      try {
        const { manualRuns } = await api.getTestRunsByRelease(r.id);
        allManualRuns.push(...manualRuns);
      } catch {}
    }
    set({ releaseTree: buildReleaseTree(releases, features, allManualRuns) });
  },

  createTestRun: async (name, releaseId) => {
    await api.createTestRun({ name, release_id: releaseId });
    await get().fetchReleaseTree();
  },

  deleteTestRun: async (runFolderId) => {
    await api.deleteRunFolder(runFolderId);
    set(s => ({
      selectedRunFolderId: s.selectedRunFolderId === runFolderId ? null : s.selectedRunFolderId,
    }));
    await get().fetchReleaseTree();
  },

  // allTestRuns: combined manual + feature runs for the release overview table
  allTestRuns: [],

  selectRelease: async (releaseId, featureId = null) => {
    set({ selectedReleaseId: releaseId, selectedFeatureId: featureId, selectedRunFolderId: null, page: 1, runItems: [] });
    // Fetch all test runs (manual + feature) for the overview table
    try {
      const { manualRuns, featureRuns } = await api.getTestRunsByRelease(releaseId);
      set({ allTestRuns: [...featureRuns, ...manualRuns] });
    } catch {
      set({ allTestRuns: [] });
    }
  },

  selectFeatureRun: async (releaseId, featureId) => {
    set({ selectedReleaseId: releaseId, selectedFeatureId: featureId, selectedRunFolderId: null, page: 1 });
    const params = { release_id: releaseId, feature_id: featureId, page: 1, limit: get().limit };
    const res = await api.getRunsByRelease(params);
    set({
      runItems: res.data || res,
      total: res.pagination?.total || 0,
      totalPages: res.pagination?.totalPages || 0,
      page: res.pagination?.page || 1,
    });
  },

  selectTestRun: async (runFolderId, releaseId) => {
    set({ selectedRunFolderId: runFolderId, selectedReleaseId: releaseId, selectedFeatureId: null, page: 1 });
    const res = await api.getRunItems(runFolderId, { page: 1, limit: get().limit });
    set({
      runItems: res.data || res,
      total: res.pagination?.total || 0,
      totalPages: res.pagination?.totalPages || 0,
      page: res.pagination?.page || 1,
      summary: null,
    });
  },

  setRunPage: async (page) => {
    const { selectedReleaseId, selectedFeatureId, limit } = get();
    set({ page });
    const params = { release_id: selectedReleaseId, page, limit };
    if (selectedFeatureId) params.feature_id = selectedFeatureId;
    const res = await api.getRunsByRelease(params);
    set({
      runItems: res.data || res,
      total: res.pagination?.total || 0,
      totalPages: res.pagination?.totalPages || 0,
      page: res.pagination?.page || 1,
    });
  },

  addRunItems: async (testcaseIds) => {
    const { selectedReleaseId, selectedFeatureId, selectedRunFolderId } = get();
    if (selectedRunFolderId) {
      // Add to named test run (run_folder)
      for (const tcId of testcaseIds) {
        await api.addRunItem({ run_folder_id: selectedRunFolderId, testcase_id: tcId });
      }
      await get().selectTestRun(selectedRunFolderId, selectedReleaseId);
    } else {
      await api.addRunToRelease({
        release_id: selectedReleaseId,
        feature_id: selectedFeatureId || null,
        testcase_ids: testcaseIds,
      });
      if (selectedFeatureId) {
        await get().selectFeatureRun(selectedReleaseId, selectedFeatureId);
      } else {
        await get().selectRelease(selectedReleaseId);
      }
    }
  },

  updateRunItem: async (id, body) => {
    await api.updateRunItem(id, body);
    const { selectedReleaseId, selectedFeatureId, selectedRunFolderId, page, limit } = get();
    // Re-fetch current view's items without resetting the view
    if (selectedRunFolderId) {
      const res = await api.getRunItems(selectedRunFolderId, { page, limit });
      set({ runItems: res.data || res, total: res.pagination?.total || 0, totalPages: res.pagination?.totalPages || 0 });
    } else if (selectedFeatureId) {
      const res = await api.getRunsByRelease({ release_id: selectedReleaseId, feature_id: selectedFeatureId, page, limit });
      set({ runItems: res.data || res, total: res.pagination?.total || 0, totalPages: res.pagination?.totalPages || 0 });
    }
  },

  deleteRunItem: async (id) => {
    await api.deleteRunItem(id);
    set(s => ({ runItems: s.runItems.filter(r => r.id !== id), total: s.total - 1 }));
  },
}));

export default useRunStore;
