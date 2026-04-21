import { create } from 'zustand';
import * as authApi from '../api/auth';

const useAppStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('atm_user') || 'null'),
  token: localStorage.getItem('atm_token') || null,
  activeTab: 'sd-wan', // 'sd-wan' | 'arista' | 'runs'

  login: async (username, password) => {
    const { user, token } = await authApi.login({ username, password });
    localStorage.setItem('atm_token', token);
    localStorage.setItem('atm_user', JSON.stringify(user));
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('atm_token');
    localStorage.removeItem('atm_user');
    set({ user: null, token: null });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  // Role helpers
  isEditor: () => {
    const role = get().user?.role;
    return role === 'editor' || role === 'run_manager';
  },
  isRunManager: () => {
    return get().user?.role === 'run_manager';
  },
}));

export default useAppStore;
