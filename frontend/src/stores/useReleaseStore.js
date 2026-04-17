import { create } from 'zustand';
import * as api from '../api/releases';

function buildTree(flat) {
  const map = {};
  flat.forEach(n => { map[n.id] = { ...n, children: [] }; });
  const roots = [];
  flat.forEach(n => {
    if (n.parent_id && map[n.parent_id]) {
      map[n.parent_id].children.push(map[n.id]);
    } else if (!n.parent_id) {
      roots.push(map[n.id]);
    }
  });
  return roots;
}

const useReleaseStore = create((set, get) => ({
  tree: [],
  selectedReleaseId: null,
  features: [],
  selectedFeature: null,
  summary: null,
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,

  fetchTree: async () => {
    const flat = await api.getReleaseTree();
    set({ tree: buildTree(flat) });
  },

  createRelease: async (name, parentId, extra = {}) => {
    await api.createRelease({ name, parent_id: parentId, ...extra });
    await get().fetchTree();
  },

  deleteRelease: async (id) => {
    await api.deleteRelease(id);
    set({ selectedReleaseId: null, features: [], selectedFeature: null, summary: null });
    await get().fetchTree();
  },

  selectRelease: async (id) => {
    set({ selectedReleaseId: id, selectedFeature: null, page: 1 });
    const [res, summary] = await Promise.all([
      api.getFeatures(id, { page: 1, limit: get().limit }),
      api.getReleaseSummary(id),
    ]);
    set({
      features: res.data || res,
      total: res.pagination?.total || 0,
      totalPages: res.pagination?.totalPages || 0,
      page: res.pagination?.page || 1,
      summary,
    });
  },

  setPage: async (page) => {
    const { selectedReleaseId, limit } = get();
    set({ page });
    const res = await api.getFeatures(selectedReleaseId, { page, limit });
    set({
      features: res.data || res,
      total: res.pagination?.total || 0,
      totalPages: res.pagination?.totalPages || 0,
      page: res.pagination?.page || 1,
    });
  },

  createFeature: async (body) => {
    const { selectedReleaseId } = get();
    const feature = await api.createFeature(selectedReleaseId, body);
    set(s => ({ features: [feature, ...s.features], total: s.total + 1 }));
    // Refresh summary
    const summary = await api.getReleaseSummary(selectedReleaseId);
    set({ summary });
    return feature;
  },

  updateFeature: async (id, body) => {
    const { selectedReleaseId } = get();
    const feature = await api.updateFeature(selectedReleaseId, id, body);
    set(s => ({
      features: s.features.map(f => f.id === feature.id ? feature : f),
      selectedFeature: s.selectedFeature?.id === feature.id ? feature : s.selectedFeature,
    }));
    const summary = await api.getReleaseSummary(selectedReleaseId);
    set({ summary });
    return feature;
  },

  deleteFeature: async (id) => {
    const { selectedReleaseId } = get();
    await api.deleteFeature(selectedReleaseId, id);
    set(s => ({
      features: s.features.filter(f => f.id !== id),
      selectedFeature: s.selectedFeature?.id === id ? null : s.selectedFeature,
      total: s.total - 1,
    }));
    const summary = await api.getReleaseSummary(selectedReleaseId);
    set({ summary });
  },

  fetchFeature: async (releaseId, featureId) => {
    const feature = await api.getFeature(releaseId, featureId);
    set({ selectedFeature: feature });
  },

  selectFeature: (feature) => set({ selectedFeature: feature }),
  clearFeature: () => set({ selectedFeature: null }),
}));

export default useReleaseStore;
