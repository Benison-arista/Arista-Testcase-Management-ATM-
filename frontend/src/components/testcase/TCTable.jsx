import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, FileText, FolderOpen, GripVertical } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import useTCStore from '../../stores/useTCStore';
import useSearchStore from '../../stores/useSearchStore';
import useFolderStore from '../../stores/useFolderStore';
import useAppStore from '../../stores/useAppStore';
import { getSchema } from '../../schemas';
import Pagination from '../common/Pagination';

const DEFAULT_COLUMNS = {
  velocloud: ['qtest_id', 'title', 'testrail_id', 'priority'],
  arista: ['arista_id', 'description', 'status', 'priority'],
};

const PRIORITY_BADGE = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-green-100 text-green-700',
};

function loadColumns(section) {
  try {
    const raw = localStorage.getItem(`atm_columns_${section}`);
    return raw ? JSON.parse(raw) : (DEFAULT_COLUMNS[section] ?? []);
  } catch {
    return DEFAULT_COLUMNS[section] ?? [];
  }
}

function saveColumns(section, cols) {
  localStorage.setItem(`atm_columns_${section}`, JSON.stringify(cols));
}

function DraggableRow({ tc, columns, onSelect }) {
  const canEdit = useAppStore(s => s.isEditor());
  const title = tc.data.title || tc.data.description || `TC #${tc.id}`;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tc-table-drag-${tc.id}`,
    data: { type: 'tc', id: tc.id, title },
    disabled: !canEdit,
  });

  return (
    <tr
      ref={setNodeRef}
      onClick={() => onSelect(tc)}
      className={`cursor-pointer hover:bg-blue-50 transition-colors ${isDragging ? 'opacity-40' : ''}`}
    >
      {canEdit && (
        <td className="pl-3 pr-0 py-2.5 w-6">
          <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500" onClick={e => e.stopPropagation()}>
            <GripVertical size={12} />
          </span>
        </td>
      )}
      {columns.map(col => {
        const val = tc.data[col.key];

        if (col.key === 'priority' && val) {
          return (
            <td key={col.key} className="px-4 py-2.5 whitespace-nowrap">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[val] || 'bg-gray-100 text-gray-600'}`}>
                {val}
              </span>
            </td>
          );
        }

        if (typeof val === 'boolean') {
          return (
            <td key={col.key} className="px-4 py-2.5 text-gray-600">
              {val ? 'Yes' : 'No'}
            </td>
          );
        }

        return (
          <td key={col.key} className="px-4 py-2.5 text-gray-700 max-w-xs">
            <div className="truncate">
              {val ?? <span className="text-gray-300">&mdash;</span>}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

export default function TCTable({ section }) {
  const canEdit = useAppStore(s => s.isEditor());
  const { list, selectTC, page, totalPages, total, setPage, fetchList } = useTCStore();
  const { results, mode, total: searchTotal, page: searchPage, totalPages: searchTotalPages } = useSearchStore();
  const { selectedFolderId } = useFolderStore();
  const schema = getSchema(section);

  const [visibleKeys, setVisibleKeys] = useState(() => loadColumns(section));
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  // Reload stored columns when section changes
  useEffect(() => {
    setVisibleKeys(loadColumns(section));
  }, [section]);

  // Close picker on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  const items = mode !== 'idle' ? results : list;

  // Ordered by schema, filtered to selected keys
  const columns = schema.filter(f => visibleKeys.includes(f.key));

  function toggleKey(key) {
    const next = visibleKeys.includes(key)
      ? visibleKeys.filter(k => k !== key)
      : [...visibleKeys, key];
    setVisibleKeys(next);
    saveColumns(section, next);
  }

  // No folder selected and not in search — prompt user
  if (mode === 'idle' && selectedFolderId === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
        <FolderOpen size={40} strokeWidth={1} />
        <p className="text-sm">Select a folder to view test cases.</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
        <FileText size={40} strokeWidth={1} />
        <p className="text-sm">No test cases in this folder.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
        <span className="text-xs text-gray-500 font-medium">
          {(mode !== 'idle' ? searchTotal : total) || items.length} test case{((mode !== 'idle' ? searchTotal : total) || items.length) !== 1 ? 's' : ''}
        </span>
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setPickerOpen(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded px-2 py-1 hover:bg-gray-100"
          >
            <SlidersHorizontal size={12} /> Columns
          </button>
          {pickerOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[180px]">
              <p className="px-3 pt-1 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                Visible columns
              </p>
              {schema.map(field => (
                <label
                  key={field.key}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={visibleKeys.includes(field.key)}
                    onChange={() => toggleKey(field.key)}
                    className="accent-blue-500"
                  />
                  {field.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_0_#e5e7eb]">
            <tr>
              {canEdit && <th className="w-6" />}
              {columns.map(col => (
                <th
                  key={col.key}
                  className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(tc => (
              <DraggableRow key={tc.id} tc={tc} columns={columns} onSelect={selectTC} />
            ))}
          </tbody>
        </table>
      </div>

      {mode === 'idle' ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={(newPage) => {
            setPage(newPage);
            fetchList({ folder_id: selectedFolderId, section, page: newPage });
          }}
        />
      ) : (
        <Pagination
          page={searchPage}
          totalPages={searchTotalPages}
          total={searchTotal}
          onPageChange={() => {}}
        />
      )}
    </div>
  );
}
