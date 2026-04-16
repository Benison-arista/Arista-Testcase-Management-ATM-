import { create } from 'zustand';
import * as api from '../api/runs';

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

const useRunStore = create((set, get) => ({
  runTree: [],
  selectedRunFolderId: null,
  runItems: [],
  report: null,
  // Pagination for run items
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,

  fetchRunTree: async () => {
    const flat = await api.getRunFolderTree();
    set({ runTree: buildTree(flat) });
  },

  createRunFolder: async (name, parentId) => {
    await api.createRunFolder({ name, parent_id: parentId });
    await get().fetchRunTree();
  },

  deleteRunFolder: async (id) => {
    await api.deleteRunFolder(id);
    set({ selectedRunFolderId: null });
    await get().fetchRunTree();
  },

  selectRunFolder: async (id) => {
    set({ selectedRunFolderId: id, report: null, page: 1 });
    const res = await api.getRunItems(id, { page: 1, limit: get().limit });
    set({
      runItems: res.data || res,
      total: res.pagination?.total || 0,
      totalPages: res.pagination?.totalPages || 0,
      page: res.pagination?.page || 1,
    });
  },

  setRunPage: async (page) => {
    const { selectedRunFolderId, limit } = get();
    set({ page });
    const res = await api.getRunItems(selectedRunFolderId, { page, limit });
    set({
      runItems: res.data || res,
      total: res.pagination?.total || 0,
      totalPages: res.pagination?.totalPages || 0,
      page: res.pagination?.page || 1,
    });
  },

  addRunItem: async (testcaseId) => {
    const { selectedRunFolderId, page, limit } = get();
    await api.addRunItem({ run_folder_id: selectedRunFolderId, testcase_id: testcaseId });
    const res = await api.getRunItems(selectedRunFolderId, { page, limit });
    set({
      runItems: res.data || res,
      total: res.pagination?.total || 0,
      totalPages: res.pagination?.totalPages || 0,
    });
  },

  updateRunItem: async (id, body) => {
    await api.updateRunItem(id, body);
    const { selectedRunFolderId, page, limit } = get();
    const res = await api.getRunItems(selectedRunFolderId, { page, limit });
    set({
      runItems: res.data || res,
      total: res.pagination?.total || 0,
      totalPages: res.pagination?.totalPages || 0,
    });
  },

  deleteRunItem: async (id) => {
    await api.deleteRunItem(id);
    set(s => ({ runItems: s.runItems.filter(r => r.id !== id), total: s.total - 1 }));
  },

  fetchReport: async (folderId) => {
    const report = await api.getReport(folderId);
    set({ report });
  },
}));

export default useRunStore;
