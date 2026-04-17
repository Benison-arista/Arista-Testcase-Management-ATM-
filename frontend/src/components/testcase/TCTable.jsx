import { useState, useRef, useEffect, useCallback } from 'react';
import { SlidersHorizontal, FileText, FolderOpen, GripVertical, ArrowLeft, ArrowRight, Pencil, Check, X, Filter, CheckSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDraggable } from '@dnd-kit/core';
import { DndContext as SortDndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useTCStore from '../../stores/useTCStore';
import useSearchStore from '../../stores/useSearchStore';
import useFolderStore from '../../stores/useFolderStore';
import useAppStore from '../../stores/useAppStore';
import { getSchema } from '../../schemas';
import Pagination from '../common/Pagination';

// Fields available for filtering (select/boolean types + key text fields)
const FILTER_FIELDS = [
  'priority', 'state', 'status', 'automatable_call', 'automation_status',
  'pillar', 'customer_found', 'template', 'module', 'section',
];

const DEFAULT_COLUMNS = {
  velocloud: ['qtest_id', 'title', 'testrail_id', 'priority'],
  arista: ['arista_id', 'description', 'status', 'priority'],
};

const PRIORITY_BADGE = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-green-100 text-green-700',
};

const MIN_COL_WIDTH = 60;
const MAX_COL_WIDTH = 800;
const DEFAULT_COL_WIDTH = 150;
const COL_PADDING = 40; // px for cell padding (px-4 = 16px each side + buffer)

// Measure text width using a shared off-screen canvas
let _measureCanvas = null;
function measureTextWidth(text, font) {
  if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
  const ctx = _measureCanvas.getContext('2d');
  ctx.font = font;
  return ctx.measureText(text).width;
}

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

function loadColWidths(section) {
  try {
    const raw = localStorage.getItem(`atm_col_widths_${section}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveColWidths(section, widths) {
  localStorage.setItem(`atm_col_widths_${section}`, JSON.stringify(widths));
}

// Draggable resize handle on the right edge of a column header
function ColResizeHandle({ colKey, onResize }) {
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    let lastX = e.clientX;

    const onMouseMove = (e) => {
      const delta = e.clientX - lastX;
      lastX = e.clientX;
      if (delta !== 0) onResize(colKey, delta);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colKey, onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group z-10"
      title="Drag to resize"
    >
      <div className="absolute right-0 top-0 bottom-0 w-px transition-colors" style={{ background: '#b0c4de' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#3d8bfd'; e.currentTarget.style.width = '3px'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#b0c4de'; e.currentTarget.style.width = '1px'; }}
      />
    </div>
  );
}

// Sortable item in the column picker
function SortablePickerItem({ field, isVisible, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-sm text-gray-700"
    >
      <span {...listeners} {...attributes} className="cursor-grab text-gray-300 hover:text-gray-500">
        <GripVertical size={12} />
      </span>
      <label className="flex items-center gap-2 flex-1 cursor-pointer">
        <input
          type="checkbox"
          checked={isVisible}
          onChange={onToggle}
          className="accent-arista-500"
        />
        {field.label}
      </label>
    </div>
  );
}

function DraggableRow({ tc, columns, colWidths, onSelect, editingColumns, section, selectMode, checked, onToggle }) {
  const navigate = useNavigate();
  const { selectedFolderId } = useFolderStore();
  const canEdit = useAppStore(s => s.isEditor());
  const title = tc.data.title || tc.data.description || `TC #${tc.id}`;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tc-table-drag-${tc.id}`,
    data: { type: 'tc', id: tc.id, title },
    disabled: !canEdit || editingColumns,
  });

  return (
    <tr
      ref={setNodeRef}
      onClick={() => {
        if (editingColumns) return;
        if (selectMode) { onToggle(tc.id); return; }
        onSelect(tc);
        const fid = tc.folder_id || selectedFolderId;
        if (fid) navigate('/' + section + '/folder/' + fid + '/tc/' + tc.id);
      }}
      className={`cursor-pointer transition-colors ${isDragging ? 'opacity-40' : ''}`}
      onMouseEnter={e => { e.currentTarget.style.background = '#e0eaf7'; }}
      onMouseLeave={e => { e.currentTarget.style.background = ''; }}
    >
      {selectMode && (
        <td className="pl-3 pr-0 py-2.5 w-8" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={checked} onChange={() => onToggle(tc.id)} className="accent-arista-500" />
        </td>
      )}
      {canEdit && !editingColumns && !selectMode && (
        <td className="pl-3 pr-0 py-2.5 w-6">
          <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500" onClick={e => e.stopPropagation()}>
            <GripVertical size={12} />
          </span>
        </td>
      )}
      {columns.map(col => {
        const val = tc.data[col.key];
        const w = colWidths[col.key];
        const style = w ? { width: w, minWidth: w, maxWidth: w } : {};

        if (col.key === 'priority' && val) {
          return (
            <td key={col.key} className="px-4 py-2.5 whitespace-nowrap" style={style}>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[val] || 'bg-gray-100 text-gray-600'}`}>
                {val}
              </span>
            </td>
          );
        }

        if (typeof val === 'boolean') {
          return (
            <td key={col.key} className="px-4 py-2.5 text-gray-600" style={style}>
              {val ? 'Yes' : 'No'}
            </td>
          );
        }

        return (
          <td key={col.key} className="px-4 py-2.5 text-gray-700" style={style}>
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
  const { list, selectTC, page, totalPages, total, setPage, fetchList, updateTC } = useTCStore();
  const { results, mode, total: searchTotal, page: searchPage, totalPages: searchTotalPages } = useSearchStore();
  const { selectedFolderId } = useFolderStore();
  const schema = getSchema(section);

  const [visibleKeys, setVisibleKeys] = useState(() => loadColumns(section));
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  // Column widths — { key: pixelWidth }
  const [colWidths, setColWidths] = useState(() => loadColWidths(section));
  const colWidthsRef = useRef(colWidths);
  useEffect(() => { colWidthsRef.current = colWidths; }, [colWidths]);

  // Edit columns mode
  const [editingColumns, setEditingColumns] = useState(false);
  const [draftKeys, setDraftKeys] = useState(null);
  const [draftWidths, setDraftWidths] = useState(null);

  // Bulk select & update mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTCIds, setSelectedTCIds] = useState(new Set());
  const [bulkValues, setBulkValues] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);

  // Filters: { fieldKey: Set of selected values } — empty means no filter
  const [filters, setFilters] = useState({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilterField, setActiveFilterField] = useState(null);
  const filterRef = useRef(null);

  // Full ordered list of all schema keys
  const [allKeysOrdered, setAllKeysOrdered] = useState(() => {
    const stored = loadColumns(section);
    const remaining = schema.map(f => f.key).filter(k => !stored.includes(k));
    return [...stored, ...remaining];
  });

  const sortSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  useEffect(() => {
    const stored = loadColumns(section);
    setVisibleKeys(stored);
    const remaining = schema.map(f => f.key).filter(k => !stored.includes(k));
    setAllKeysOrdered([...stored, ...remaining]);
    setColWidths(loadColWidths(section));
    setEditingColumns(false);
    setDraftKeys(null);
    setDraftWidths(null);
    setFilters({});
    setFilterOpen(false);
  }, [section]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  useEffect(() => {
    function handleFilterClickOutside(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    }
    if (filterOpen) document.addEventListener('mousedown', handleFilterClickOutside);
    return () => document.removeEventListener('mousedown', handleFilterClickOutside);
  }, [filterOpen]);

  const rawItems = mode !== 'idle' ? results : list;

  // Apply client-side filters
  const activeFilterCount = Object.values(filters).filter(s => s.size > 0).length;
  const items = activeFilterCount === 0 ? rawItems : rawItems.filter(tc => {
    for (const [key, allowed] of Object.entries(filters)) {
      if (allowed.size === 0) continue;
      const val = tc.data?.[key];
      const strVal = val === true ? 'Yes' : val === false ? 'No' : (val == null || val === '' ? '(empty)' : String(val));
      if (!allowed.has(strVal)) return false;
    }
    return true;
  });

  // Get unique values for a filter field from current raw items
  function getUniqueValues(fieldKey) {
    const vals = new Set();
    rawItems.forEach(tc => {
      const val = tc.data?.[fieldKey];
      if (val === true) vals.add('Yes');
      else if (val === false) vals.add('No');
      else if (val == null || val === '') vals.add('(empty)');
      else vals.add(String(val));
    });
    return [...vals].sort((a, b) => a === '(empty)' ? 1 : b === '(empty)' ? -1 : a.localeCompare(b));
  }

  function toggleFilter(fieldKey, value) {
    setFilters(prev => {
      const current = prev[fieldKey] || new Set();
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [fieldKey]: next };
    });
  }

  function clearFilter(fieldKey) {
    setFilters(prev => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }

  function clearAllFilters() {
    setFilters({});
  }

  const activeKeys = editingColumns && draftKeys ? draftKeys : visibleKeys;
  const activeWidths = editingColumns && draftWidths ? draftWidths : colWidths;
  const columns = activeKeys.map(k => schema.find(f => f.key === k)).filter(Boolean);

  function toggleKey(key) {
    const next = visibleKeys.includes(key)
      ? visibleKeys.filter(k => k !== key)
      : [...visibleKeys, key];
    setVisibleKeys(next);
    saveColumns(section, next);
  }

  function handleSortEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = allKeysOrdered.indexOf(active.id);
    const newIndex = allKeysOrdered.indexOf(over.id);
    const newOrder = arrayMove(allKeysOrdered, oldIndex, newIndex);
    setAllKeysOrdered(newOrder);

    const newVisible = newOrder.filter(k => visibleKeys.includes(k));
    setVisibleKeys(newVisible);
    saveColumns(section, newVisible);
  }

  // --- Normal mode: live column resize ---
  const saveTimeout = useRef(null);
  const handleLiveResize = useCallback((key, delta) => {
    setColWidths(prev => {
      const current = prev[key] || DEFAULT_COL_WIDTH;
      const next = { ...prev, [key]: Math.max(MIN_COL_WIDTH, current + delta) };
      // Debounce localStorage write — save only after drag settles
      clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => saveColWidths(section, next), 200);
      return next;
    });
  }, [section]);

  // --- Edit mode handlers ---
  function startEditColumns() {
    setDraftKeys([...visibleKeys]);
    setDraftWidths({ ...colWidths });
    setEditingColumns(true);
    setPickerOpen(false);
  }

  function moveColumnLeft(index) {
    if (index <= 0) return;
    setDraftKeys(prev => arrayMove(prev, index, index - 1));
  }

  function moveColumnRight(index) {
    setDraftKeys(prev => {
      if (index >= prev.length - 1) return prev;
      return arrayMove(prev, index, index + 1);
    });
  }

  const handleDraftResize = useCallback((key, delta) => {
    setDraftWidths(prev => {
      const current = (prev || {})[key] || DEFAULT_COL_WIDTH;
      return { ...prev, [key]: Math.max(MIN_COL_WIDTH, current + delta) };
    });
  }, []);

  function saveEdits() {
    if (draftKeys) {
      setVisibleKeys(draftKeys);
      saveColumns(section, draftKeys);
      const remaining = schema.map(f => f.key).filter(k => !draftKeys.includes(k));
      setAllKeysOrdered([...draftKeys, ...remaining]);
    }
    if (draftWidths) {
      setColWidths(draftWidths);
      saveColWidths(section, draftWidths);
    }
    setEditingColumns(false);
    setDraftKeys(null);
    setDraftWidths(null);
  }

  function cancelEdits() {
    setEditingColumns(false);
    setDraftKeys(null);
    setDraftWidths(null);
  }

  // Bulk select helpers
  const toggleTCSelect = (id) => setSelectedTCIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllTCs = () => {
    if (selectedTCIds.size === items.length) setSelectedTCIds(new Set());
    else setSelectedTCIds(new Set(items.map(tc => tc.id)));
  };
  const exitSelectMode = () => { setSelectMode(false); setSelectedTCIds(new Set()); setBulkValues({}); };

  const handleBulkSave = async () => {
    if (selectedTCIds.size === 0 || Object.keys(bulkValues).length === 0) return;
    setBulkSaving(true);
    try {
      for (const tcId of selectedTCIds) {
        const tc = items.find(t => t.id === tcId);
        if (!tc) continue;
        const updatedData = { ...tc.data, ...bulkValues };
        await updateTC(tcId, { data: updatedData, version: tc.version });
      }
      // Refresh the list
      fetchList({ folder_id: selectedFolderId, section, page });
      exitSelectMode();
    } catch (err) {
      alert(err.response?.data?.error || 'Bulk update failed');
    }
    setBulkSaving(false);
  };

  // Auto-fit column width to longest content on double-click
  function autoFitColumn(colKey) {
    const field = schema.find(f => f.key === colKey);
    if (!field) return;

    const font = '14px ui-sans-serif, system-ui, sans-serif'; // matches text-sm
    const headerFont = 'bold 12px ui-sans-serif, system-ui, sans-serif'; // matches text-xs font-semibold

    // Measure header label
    let maxWidth = measureTextWidth(field.label.toUpperCase(), headerFont);

    // Measure all visible row values
    for (const tc of items) {
      let val = tc.data[colKey];
      if (val === undefined || val === null) continue;
      if (typeof val === 'boolean') val = val ? 'Yes' : 'No';
      const text = String(val);
      // Only measure first line for multi-line values
      const firstLine = text.split('\n')[0];
      const w = measureTextWidth(firstLine, font);
      if (w > maxWidth) maxWidth = w;
    }

    const fitWidth = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, Math.ceil(maxWidth + COL_PADDING)));

    if (editingColumns) {
      setDraftWidths(prev => ({ ...prev, [colKey]: fitWidth }));
    } else {
      setColWidths(prev => {
        const next = { ...prev, [colKey]: fitWidth };
        saveColWidths(section, next);
        return next;
      });
    }
  }

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

  const resizeHandler = editingColumns ? handleDraftResize : handleLiveResize;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: '1px solid #d0def4', background: '#f0f5fc' }}>
        <span className="text-xs text-gray-500 font-medium">
          {activeFilterCount > 0
            ? items.length + ' of ' + ((mode !== 'idle' ? searchTotal : total) || rawItems.length) + ' test cases (filtered)'
            : ((mode !== 'idle' ? searchTotal : total) || items.length) + ' test case' + (((mode !== 'idle' ? searchTotal : total) || items.length) !== 1 ? 's' : '')
          }
        </span>
        <div className="flex items-center gap-2">
          {editingColumns ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-arista-500 mr-1">Drag column edges to resize</span>
              <button
                onClick={saveEdits}
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 border border-green-300 bg-green-50 rounded px-2 py-1 hover:bg-green-100"
              >
                <Check size={12} /> Save
              </button>
              <button
                onClick={cancelEdits}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded px-2 py-1 hover:bg-gray-100"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          ) : (
            <>
              {/* Filter button */}
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => { setFilterOpen(v => !v); setPickerOpen(false); }}
                  style={activeFilterCount > 0
                    ? { color: '#fff', borderColor: '#0e6856', background: '#0e6856' }
                    : { color: '#0e6856', borderColor: '#6ee7b7', background: '#ecfdf5' }
                  }
                  className="flex items-center gap-1 text-xs font-semibold border rounded px-2 py-1 hover:opacity-85 transition-opacity"
                  title="Filter test cases"
                >
                  <Filter size={12} /> Filter
                  {activeFilterCount > 0 && (
                    <span className="text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center ml-0.5" style={{ background: '#fff', color: '#0e6856' }}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                {filterOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[280px] max-h-[450px] flex flex-col" onClick={e => e.stopPropagation()}>
                    {/* Filter header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Filters</span>
                      {activeFilterCount > 0 && (
                        <button onClick={clearAllFilters} className="text-xs text-red-500 hover:text-red-700 font-medium">
                          Clear all
                        </button>
                      )}
                    </div>
                    {/* Filter field tabs */}
                    <div className="flex border-b border-gray-100 overflow-x-auto shrink-0">
                      {FILTER_FIELDS.map(key => {
                        const field = schema.find(f => f.key === key);
                        if (!field) return null;
                        const isActive = activeFilterField === key;
                        const hasFilter = filters[key]?.size > 0;
                        return (
                          <button
                            key={key}
                            onClick={() => setActiveFilterField(isActive ? null : key)}
                            className={`px-3 py-1.5 text-xs whitespace-nowrap border-b-2 transition-colors ${
                              isActive ? 'border-arista-500 font-semibold' : 'border-transparent hover:bg-gray-50'
                            }`}
                            style={isActive ? { color: '#1a56b0' } : hasFilter ? { color: '#0e6856', fontWeight: 600 } : { color: '#6b7280' }}
                          >
                            {field.label}
                            {hasFilter && <span className="ml-1 text-[10px]">({filters[key].size})</span>}
                          </button>
                        );
                      })}
                    </div>
                    {/* Filter values for selected field */}
                    <div className="flex-1 overflow-y-auto p-2">
                      {activeFilterField ? (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-400">{getUniqueValues(activeFilterField).length} values</span>
                            {filters[activeFilterField]?.size > 0 && (
                              <button onClick={() => clearFilter(activeFilterField)} className="text-xs text-red-500 hover:text-red-700">Clear</button>
                            )}
                          </div>
                          {getUniqueValues(activeFilterField).map(val => {
                            const isChecked = filters[activeFilterField]?.has(val) || false;
                            return (
                              <label key={val} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleFilter(activeFilterField, val)}
                                  className="accent-arista-500"
                                />
                                <span className={val === '(empty)' ? 'italic text-gray-400' : ''}>{val}</span>
                              </label>
                            );
                          })}
                        </>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-4">Select a field above to filter by its values</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={startEditColumns}
                style={{ color: '#1a56b0', borderColor: '#a1bde9', background: '#e8f0fe' }}
                className="flex items-center gap-1 text-xs font-semibold border rounded px-2 py-1 hover:opacity-85 transition-opacity"
                title="Rearrange and resize columns"
              >
                <Pencil size={12} /> Edit Columns
              </button>
              <div className="relative" ref={pickerRef}>
                <button
                  onClick={() => setPickerOpen(v => !v)}
                  style={{ color: '#6d28d9', borderColor: '#c4b5fd', background: '#f5f3ff' }}
                  className="flex items-center gap-1 text-xs font-semibold border rounded px-2 py-1 hover:opacity-85 transition-opacity"
                >
                  <SlidersHorizontal size={12} /> Columns
                </button>
                {pickerOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[220px] max-h-[400px] overflow-y-auto">
                    <p className="px-3 pt-1 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      Drag to reorder
                    </p>
                    <SortDndContext sensors={sortSensors} collisionDetection={closestCenter} onDragEnd={handleSortEnd}>
                      <SortableContext items={allKeysOrdered} strategy={verticalListSortingStrategy}>
                        {allKeysOrdered.map(key => {
                          const field = schema.find(f => f.key === key);
                          if (!field) return null;
                          return (
                            <SortablePickerItem
                              key={key}
                              field={field}
                              isVisible={visibleKeys.includes(key)}
                              onToggle={() => toggleKey(key)}
                            />
                          );
                        })}
                      </SortableContext>
                    </SortDndContext>
                  </div>
                )}
              </div>
              {/* Select multiple button */}
              {canEdit && !selectMode && (
                <button
                  onClick={() => setSelectMode(true)}
                  style={{ color: '#0e2e5b', borderColor: '#a1bde9', background: '#dbeafe' }}
                  className="flex items-center gap-1 text-xs font-semibold border rounded px-2 py-1 hover:opacity-85 transition-opacity"
                >
                  <CheckSquare size={12} /> Select multiple
                </button>
              )}
              {selectMode && (
                <button
                  onClick={exitSelectMode}
                  className="flex items-center gap-1 text-xs font-medium border border-gray-300 rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
                >
                  Exit selection
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bulk update bar */}
      {selectMode && selectedTCIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 shrink-0 flex-wrap" style={{ background: '#dbeafe', borderBottom: '1px solid #a1bde9' }}>
          <span className="text-xs font-semibold" style={{ color: '#0e2e5b' }}>{selectedTCIds.size} selected</span>
          <span className="text-xs text-gray-400">Update:</span>
          <select className="text-xs border border-gray-300 rounded px-1.5 py-0.5" value={bulkValues.priority || ''} onChange={e => setBulkValues(prev => ({ ...prev, priority: e.target.value || undefined }))}>
            <option value="">Priority</option>
            <option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option>
          </select>
          <select className="text-xs border border-gray-300 rounded px-1.5 py-0.5" value={bulkValues.pillar || ''} onChange={e => setBulkValues(prev => ({ ...prev, pillar: e.target.value || undefined }))}>
            <option value="">Pillar</option>
            <option value="Management Plane">Management Plane</option><option value="Data Plane">Data Plane</option><option value="Platform">Platform</option><option value="Interop">Interop</option>
          </select>
          <select className="text-xs border border-gray-300 rounded px-1.5 py-0.5" value={bulkValues.automatable_call || ''} onChange={e => setBulkValues(prev => ({ ...prev, automatable_call: e.target.value || undefined }))}>
            <option value="">Automatable</option>
            <option value="Yes">Yes</option><option value="No">No</option>
          </select>
          <select className="text-xs border border-gray-300 rounded px-1.5 py-0.5" value={bulkValues.automation_status || ''} onChange={e => setBulkValues(prev => ({ ...prev, automation_status: e.target.value || undefined }))}>
            <option value="">Automation Status</option>
            <option value="Not Automated">Not Automated</option><option value="Automated">Automated</option><option value="In Progress">In Progress</option>
          </select>
          <select className="text-xs border border-gray-300 rounded px-1.5 py-0.5" value={bulkValues.state || ''} onChange={e => setBulkValues(prev => ({ ...prev, state: e.target.value || undefined }))}>
            <option value="">State</option>
            <option value="Active">Active</option><option value="Draft">Draft</option><option value="Deprecated">Deprecated</option>
          </select>
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={handleBulkSave} disabled={bulkSaving || Object.keys(bulkValues).filter(k => bulkValues[k]).length === 0} className="text-xs font-semibold px-2.5 py-1 rounded" style={{ color: '#fff', background: bulkSaving ? '#9ca3af' : '#22c55e' }}>
              {bulkSaving ? 'Saving...' : 'Apply'}
            </button>
            <button onClick={exitSelectMode} className="text-xs font-medium px-2 py-1 rounded text-gray-500 hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="text-sm border-collapse" style={{ tableLayout: 'fixed', minWidth: '100%' }}>
          <thead className="sticky top-0 z-10" style={{ background: '#e8f0fe', boxShadow: '0 1px 0 0 #d0def4' }}>
            <tr>
              {selectMode && <th className="w-8 px-2"><input type="checkbox" checked={selectedTCIds.size === items.length && items.length > 0} onChange={toggleAllTCs} className="accent-arista-500" /></th>}
              {canEdit && !editingColumns && !selectMode && <th className="w-6" />}
              {columns.map((col, idx) => {
                const w = activeWidths[col.key];
                const thStyle = w ? { width: w, minWidth: MIN_COL_WIDTH } : { minWidth: MIN_COL_WIDTH };
                return (
                  <th
                    key={col.key}
                    className={`text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap relative ${editingColumns ? 'bg-arista-50' : ''}`}
                    style={thStyle}
                    onDoubleClick={() => autoFitColumn(col.key)}
                    title="Double-click to auto-fit width"
                  >
                    {editingColumns ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveColumnLeft(idx)}
                          disabled={idx === 0}
                          className="p-0.5 rounded hover:bg-arista-200 disabled:opacity-20 disabled:cursor-not-allowed"
                          title="Move left"
                        >
                          <ArrowLeft size={12} />
                        </button>
                        <span className="flex-1 text-center truncate">{col.label}</span>
                        <button
                          onClick={() => moveColumnRight(idx)}
                          disabled={idx === columns.length - 1}
                          className="p-0.5 rounded hover:bg-arista-200 disabled:opacity-20 disabled:cursor-not-allowed"
                          title="Move right"
                        >
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    ) : (
                      col.label
                    )}
                    <ColResizeHandle colKey={col.key} onResize={resizeHandler} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(tc => (
              <DraggableRow key={tc.id} tc={tc} columns={columns} colWidths={activeWidths} onSelect={selectTC} editingColumns={editingColumns} section={section} selectMode={selectMode} checked={selectedTCIds.has(tc.id)} onToggle={toggleTCSelect} />
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
