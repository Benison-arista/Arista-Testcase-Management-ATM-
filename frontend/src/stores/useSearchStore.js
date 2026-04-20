import { create } from 'zustand';
import * as api from '../api/testcases';
import { getIdKey } from '../schemas';

const useSearchStore = create((set) => ({
  query: '',
  results: [],
  mode: 'idle', // 'idle' | 'exact' | 'filter'
  searching: false,
  total: 0,
  page: 1,
  totalPages: 0,

  search: async (q, section, { page = 1, limit = 50 } = {}) => {
    set({ query: q });
    if (!q.trim()) { set({ results: [], mode: 'idle', searching: false, total: 0, page: 1, totalPages: 0 }); return; }

    set({ searching: true });
    const res = await api.searchTestcases({ q, section, page, limit });
    const rows = res.data || res;
    const pagination = res.pagination || {};
    const idKey = getIdKey(section);
    const exactMatch = rows.find(r => r.data[idKey] === q);

    if (exactMatch) {
      set({ results: [exactMatch], mode: 'exact', searching: false, total: 1, page: 1, totalPages: 1 });
    } else {
      set({
        results: rows,
        mode: 'filter',
        searching: false,
        total: pagination.total || rows.length,
        page: pagination.page || 1,
        totalPages: pagination.totalPages || 1,
      });
    }
  },

  clearSearch: () => set({ query: '', results: [], mode: 'idle', searching: false, total: 0, page: 1, totalPages: 0 }),
}));

export default useSearchStore;
