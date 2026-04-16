import { create } from 'zustand';
import * as api from '../api/folders';

// Convert flat array from CTE into nested tree
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

const useFolderStore = create((set, get) => ({
  tree: [],
  selectedFolderId: null,

  fetchTree: async (section) => {
    const flat = await api.getFolderTree(section);
    set({ tree: buildTree(flat) });
  },

  createFolder: async (name, parentId, section) => {
    await api.createFolder({ name, parent_id: parentId, section });
    await get().fetchTree(section);
  },

  moveFolder: async (id, parentId, section) => {
    await api.moveFolder(id, { parent_id: parentId ?? null });
    await get().fetchTree(section);
  },

  deleteFolder: async (id, section) => {
    await api.deleteFolder(id);
    await get().fetchTree(section);
  },

  selectFolder: (id) => set({ selectedFolderId: id }),

  // Find children of a folder in the tree
  getChildren: (folderId) => {
    if (!folderId) return [];
    const { tree } = get();
    function findNode(nodes) {
      for (const n of nodes) {
        if (n.id === folderId) return n.children || [];
        const found = findNode(n.children || []);
        if (found) return found;
      }
      return null;
    }
    return findNode(tree) || [];
  },
}));

export default useFolderStore;
