import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, FileSpreadsheet } from 'lucide-react';
import { getSchema } from '../../schemas';
import useFolderStore from '../../stores/useFolderStore';
import { importTestcases } from '../../api/testcases';

export default function ExcelImport({ section, onClose }) {
  const schema = getSchema(section);
  const { selectedFolderId } = useFolderStore();

  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [step, setStep] = useState('upload'); // 'upload' | 'sheet' | 'map' | 'done'
  const [readProgress, setReadProgress] = useState(0);   // 0-100 during file read
  const [reading, setReading] = useState(false);         // true = reading from disk
  const [parsing, setParsing] = useState(false);         // true = XLSX.read() in progress
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const CHUNK_SIZE = 100;
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const workbookRef = useRef(null);
  const fileRef = useRef();

  const loadSheet = (wb, sheetName) => {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!data.length) { setError(`Sheet "${sheetName}" is empty.`); return; }
    setError('');
    setHeaders(Object.keys(data[0]));
    setRows(data);
    const autoMap = {};
    schema.forEach(f => {
      const match = Object.keys(data[0]).find(
        h => h.toLowerCase().replace(/[\s_-]/g, '') === f.label.toLowerCase().replace(/[\s_-]/g, '')
          || h.toLowerCase().replace(/[\s_-]/g, '') === f.key.toLowerCase().replace(/[\s_-]/g, '')
      );
      if (match) autoMap[f.key] = match;
    });
    setMapping(autoMap);
    setStep('map');
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setFileName(file.name);
    setReadProgress(0);
    setReading(true);

    const reader = new FileReader();

    reader.onprogress = (evt) => {
      if (evt.lengthComputable) {
        setReadProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };

    reader.onload = (evt) => {
      setReadProgress(100);
      setReading(false);
      setParsing(true);
      // Yield to the browser so the 100% state renders before the
      // synchronous (potentially slow) XLSX parse blocks the thread
      setTimeout(() => {
        try {
          const wb = XLSX.read(evt.target.result, { type: 'binary' });
          workbookRef.current = wb;
          setParsing(false);
          if (wb.SheetNames.length === 1) {
            loadSheet(wb, wb.SheetNames[0]);
          } else {
            setSheetNames(wb.SheetNames);
            setSelectedSheet(wb.SheetNames[0]);
            setStep('sheet');
          }
        } catch {
          setParsing(false);
          setError('Failed to parse file. Make sure it is a valid Excel or CSV file.');
        }
      }, 50);
    };

    reader.onerror = () => {
      setReading(false);
      setParsing(false);
      setError('Failed to read file.');
    };

    reader.readAsBinaryString(file);
  };

  const handleSheetConfirm = () => {
    loadSheet(workbookRef.current, selectedSheet);
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    const tcRows = rows.map(row => {
      const data = {};
      schema.forEach(f => {
        if (mapping[f.key]) data[f.key] = row[mapping[f.key]];
      });
      return data;
    });

    // Split into chunks to avoid request body size limits
    const chunks = [];
    for (let i = 0; i < tcRows.length; i += CHUNK_SIZE) {
      chunks.push(tcRows.slice(i, i + CHUNK_SIZE));
    }

    setImportProgress({ done: 0, total: tcRows.length });
    let totalImported = 0;

    try {
      for (const chunk of chunks) {
        const res = await importTestcases({
          rows: chunk,
          section,
          folder_id: selectedFolderId,
        });
        totalImported += res.imported;
        setImportProgress({ done: totalImported, total: tcRows.length });
      }
      setResult({ imported: totalImported });
      setStep('done');
      // List refresh is handled by TCSection's onClose handler
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-green-600" /> Import from Excel
          </h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="px-5 py-4">
          {step === 'upload' && !reading && (
            <label className="flex flex-col items-center gap-3 border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-arista-400 transition-colors">
              <Upload size={32} className="text-gray-400" />
              <span className="text-sm text-gray-500">Click to upload or drag an .xlsx / .xls / .csv file</span>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </label>
          )}

          {step === 'upload' && (reading || parsing) && (
            <div className="flex flex-col gap-4 border-2 border-arista-200 bg-arista-50 rounded-xl p-8">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={24} className="text-arista-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{fileName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {parsing ? 'Parsing workbook…' : 'Reading file…'}
                  </p>
                </div>
                {reading && (
                  <span className="text-sm font-semibold text-arista-500 shrink-0">{readProgress}%</span>
                )}
              </div>
              {/* Determinate bar during file read */}
              {reading && (
                <div className="w-full bg-arista-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-arista-500 h-2.5 rounded-full transition-all duration-150"
                    style={{ width: `${readProgress}%` }}
                  />
                </div>
              )}
              {/* Indeterminate bar during XLSX parsing */}
              {parsing && (
                <div className="w-full bg-arista-200 rounded-full h-2.5 overflow-hidden">
                  <div className="h-2.5 w-2/5 bg-arista-500 rounded-full animate-indeterminate" />
                </div>
              )}
            </div>
          )}

          {step === 'sheet' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-600">
                This workbook has <strong>{sheetNames.length}</strong> sheets. Select the one that contains your test cases:
              </p>
              <div className="flex flex-col gap-2">
                {sheetNames.map(name => (
                  <label
                    key={name}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSheet === name
                        ? 'border-arista-500 bg-arista-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sheet"
                      value={name}
                      checked={selectedSheet === name}
                      onChange={() => setSelectedSheet(name)}
                      className="accent-arista-500"
                    />
                    <span className="text-sm text-gray-800">{name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 'map' && (
            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
              <p className="text-sm text-gray-600">
                Found <strong>{rows.length}</strong> rows. Map Excel columns to schema fields:
              </p>
              {schema.map(f => (
                <div key={f.key} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-700 w-36 shrink-0">
                    {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </span>
                  <select
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                    value={mapping[f.key] || ''}
                    onChange={e => setMapping(prev => ({ ...prev, [f.key]: e.target.value || undefined }))}
                  >
                    <option value="">— skip —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {importing && importProgress.total > 0 && (
            <div className="flex flex-col gap-2 py-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Importing…</span>
                <span>{importProgress.done} / {importProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-arista-500 h-2 rounded-full transition-all"
                  style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div className="text-center py-6">
              <p className="text-3xl font-bold text-green-600">{result.imported}</p>
              <p className="text-sm text-gray-500 mt-1">test cases imported successfully.</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            {step === 'done' ? 'Close' : 'Cancel'}
          </button>
          {step === 'sheet' && (
            <button
              onClick={handleSheetConfirm}
              className="px-4 py-2 text-sm bg-arista-500 text-white rounded-lg hover:bg-arista-600"
            >
              Use this sheet →
            </button>
          )}
          {step === 'map' && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {importing ? 'Importing…' : `Import ${rows.length} rows`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
