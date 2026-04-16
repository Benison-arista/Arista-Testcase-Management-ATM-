import { create } from 'zustand';
import * as api from '../api/testcases';

const useTCStore = create((set, get) => ({
  list: [],
  selectedTC: null,
  history: [],
  loading: false,
  // Pagination state
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,

  fetchList: async (params) => {
    const state = get();
    const page = params?.page ?? state.page;
    const limit = params?.limit ?? state.limit;
    set({ loading: true });
    try {
      const res = await api.listTestcases({ ...params, page, limit });
      set({
        list: res.data,
        total: res.pagination.total,
        totalPages: res.pagination.totalPages,
        page: res.pagination.page,
        loading: false,
        selectedTC: null,
      });
    } catch (err) {
      console.error('fetchList failed:', err);
      set({ loading: false });
    }
  },

  setPage: (page) => set({ page }),

  clearList: () => set({ list: [], selectedTC: null, loading: false, page: 1, total: 0, totalPages: 0 }),

  fetchTC: async (id) => {
    const tc = await api.getTestcase(id);
    set({ selectedTC: tc });
  },

  fetchHistory: async (id) => {
    const res = await api.getHistory(id);
    // Supports both paginated { data, pagination } and raw array
    set({ history: res.data || res });
  },

  createTC: async (body) => {
    const tc = await api.createTestcase(body);
    set(s => ({ list: [tc, ...s.list], total: s.total + 1 }));
    return tc;
  },

  updateTC: async (id, body) => {
    const tc = await api.updateTestcase(id, body);
    set(s => ({
      list: s.list.map(t => t.id === tc.id ? tc : t),
      selectedTC: tc,
    }));
    return tc;
  },

  moveTC: async (id, folderId) => {
    await api.updateTestcase(id, { folder_id: folderId });
    // Remove from current list since it moved to a different folder
    set(s => ({
      list: s.list.filter(t => t.id !== id),
      selectedTC: s.selectedTC?.id === id ? null : s.selectedTC,
      total: s.total - 1,
    }));
  },

  deleteTC: async (id) => {
    await api.deleteTestcase(id);
    set(s => ({ list: s.list.filter(t => t.id !== id), selectedTC: null, total: s.total - 1 }));
  },

  selectTC: (tc) => set({ selectedTC: tc }),
  clearTC: ()    => set({ selectedTC: null }),
}));

export default useTCStore;
