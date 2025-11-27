import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';

// Incident Excel Processor - v6 (All features)
// - Confirmation modal on Clear/Delete
// - Keyboard shortcut Ctrl+K to clear
// - Fade-out animation when clearing preview
// - Export writes real Excel date cells for timestamp columns
// - Debounced global filter + column-specific filter types (date-range & numeric-range for intervals)

export default function IncidentExcelProcessor() {
  const [fileName, setFileName] = useState(null);
  const [fileValid, setFileValid] = useState(false);
  const [inputFile, setInputFile] = useState(null);
  const [message, setMessage] = useState('Select a .xlsx file');
  const [processing, setProcessing] = useState(false);

  // preview & data
  const [allHeaders, setAllHeaders] = useState([]);
  const [allRows, setAllRows] = useState([]); // full processed rows (array of objects)
  const [totalRowsCount, setTotalRowsCount] = useState(0);

  // Table UI states
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  // Pagination
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // UI extras
  const fileInputRef = useRef(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Debounce timer refs
  const globalFilterTimer = useRef(null);
  const columnFilterTimers = useRef({});

  // keyboard shortcut (Ctrl+K to clear)
  useEffect(() => {
    const onKey = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isClearShortcut = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isClearShortcut) {
        e.preventDefault();
        if (fileValid || allRows.length > 0) setShowConfirmClear(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fileValid, allRows]);

  function validateFile(file) {
    if (!file) return false;
    const fn = file.name || '';
    return fn.toLowerCase().endsWith('.xlsx');
  }

  function resetAllState(withAnimation = true) {
    if (withAnimation) {
      setIsFadingOut(true);
      // allow animation to play then clear
      setTimeout(() => {
        _clearState();
        setIsFadingOut(false);
      }, 350);
    } else {
      _clearState();
    }
  }
  function _clearState() {
    setFileName(null);
    setFileValid(false);
    setInputFile(null);
    setMessage('Select a .xlsx file');
    setProcessing(false);
    setAllHeaders([]);
    setAllRows([]);
    setTotalRowsCount(0);
    setGlobalFilter('');
    setColumnFilters({});
    setSortKey(null);
    setSortDir('asc');
    setPageSize(25);
    setCurrentPage(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    // reset preview state but not animate here
    _clearState();
    if (!file) {
      setMessage('No file selected');
      return;
    }
    if (!validateFile(file)) {
      setMessage('Only .xlsx files are accepted.');
      return;
    }
    setInputFile(file);
    setFileName(file.name);
    setFileValid(true);
    setMessage(`${file.name} ready`);
  }

  // --- Date helpers ---
  function excelSerialToDate(serial) {
    if (typeof serial !== 'number') return null;
    const ms = (serial - 25569) * 86400 * 1000;
    return new Date(ms);
  }
  function parseToDate(val) {
    if (val == null || val === '') return null;
    if (val instanceof Date && !isNaN(val)) return val;
    if (typeof val === 'number') {
      const d = excelSerialToDate(val);
      if (d && !isNaN(d)) return d;
    }
    const s = String(val).trim();
    const p = Date.parse(s);
    if (!isNaN(p)) return new Date(p);
    const re = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[ ,T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?$/;
    const m = s.match(re);
    if (m) {
      let day = parseInt(m[1], 10);
      let month = parseInt(m[2], 10) - 1;
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      let hour = parseInt(m[4], 10);
      const minute = parseInt(m[5], 10);
      const second = m[6] ? parseInt(m[6], 10) : 0;
      const ampm = m[7];
      if (ampm) {
        if (/pm/i.test(ampm) && hour < 12) hour += 12;
        if (/am/i.test(ampm) && hour === 12) hour = 0;
      }
      return new Date(year, month, day, hour, minute, second);
    }
    return null;
  }
  function formatIso(dt) {
    if (!dt || isNaN(dt)) return '';
    const y = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    const ss = String(dt.getSeconds()).padStart(2, '0');
    return `${y}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }
  function formatInterval(ms) {
    if (ms == null || isNaN(ms)) return '';
    if (ms < 0) ms = Math.abs(ms);
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    let rem = totalSeconds % 86400;
    const hours = Math.floor(rem / 3600);
    rem = rem % 3600;
    const minutes = Math.floor(rem / 60);
    const seconds = rem % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }

  function normalizeKey(keys, target) {
    const lower = target.toLowerCase().replace(/\s+/g, '');
    for (const k of keys) if (k.toLowerCase().replace(/\s+/g, '') === lower) return k;
    for (const k of keys) if (k.toLowerCase().includes(target.toLowerCase())) return k;
    return null;
  }
  function getOrdinalSuffix(n) {
    const j = n % 10, k = n % 100;
    if (k >= 11 && k <= 13) return 'th';
    if (j === 1) return 'st';
    if (j === 2) return 'nd';
    if (j === 3) return 'rd';
    return 'th';
  }

  function parseWorkbook(workbook) {
    const firstSheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
    return { rows, sheet: ws };
  }

  function processRows(rows) {
    if (!rows || rows.length === 0) return { headers: [], data: [] };
    const allKeys = Object.keys(rows[0]);
    const keyNumber = normalizeKey(allKeys, 'Number') || 'Number';
    const keyPriority = normalizeKey(allKeys, 'Priority') || 'Priority';
    const keyOpened = normalizeKey(allKeys, 'Opened') || 'Opened';
    const keyUpdated = normalizeKey(allKeys, 'Updated') || 'Updated';

    const groups = {};
    for (const r of rows) {
      const num = (r[keyNumber] || '').toString().trim();
      if (!num) continue;
      if (!groups[num]) groups[num] = { priority: r[keyPriority] || '', openedCandidates: [], updatedCandidates: [] };
      const openedCell = r[keyOpened];
      if (openedCell !== undefined && openedCell !== null && openedCell !== '') groups[num].openedCandidates.push(openedCell);
      const updCell = r[keyUpdated];
      if (updCell !== undefined && updCell !== null && updCell !== '') {
        if (typeof updCell === 'string') {
          const parts = updCell.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean);
          groups[num].updatedCandidates.push(...parts);
        } else {
          groups[num].updatedCandidates.push(updCell);
        }
      }
    }

    const outRows = [];
    let maxUpdates = 0;
    for (const [num, info] of Object.entries(groups)) {
      let openedDate = null;
      for (const cand of info.openedCandidates) {
        const d = parseToDate(cand);
        if (d && (!openedDate || d < openedDate)) openedDate = d;
      }
      const parsedUpdates = info.updatedCandidates
        .map(u => ({ raw: u, d: parseToDate(u) }))
        .sort((a, b) => {
          if (a.d && b.d) return a.d - b.d;
          if (a.d) return -1;
          if (b.d) return 1;
          return String(a.raw).localeCompare(String(b.raw));
        });
      const updatesRaw = parsedUpdates.map(p => ({ raw: p.raw, date: p.d }));
      if (updatesRaw.length > maxUpdates) maxUpdates = updatesRaw.length;
      outRows.push({ number: num, priority: info.priority, openedDate, updates: updatesRaw });
    }

    const headers = ['Number', 'Priority', 'Opened Date TimeStamp'];
    for (let i = 0; i < maxUpdates; i++) headers.push(`${i + 1}${getOrdinalSuffix(i + 1)} Updated TimeStamp`);
    for (let i = 0; i < maxUpdates; i++) {
      if (i === 0) headers.push(`Interval 1 (Opened to 1st Updated)`);
      else headers.push(`Interval ${i + 1} (${i}th Updated to ${i + 1}th Updated)`);
    }

    const data = outRows.map(r => {
      const row = { Number: r.number, Priority: r.priority, 'Opened Date TimeStamp': r.openedDate ? formatIso(r.openedDate) : '' };
      for (let i = 0; i < maxUpdates; i++) {
        const upd = r.updates[i];
        row[`${i + 1}${getOrdinalSuffix(i + 1)} Updated TimeStamp`] = upd && upd.date ? formatIso(upd.date) : (upd ? String(upd.raw) : '');
      }
      for (let i = 0; i < maxUpdates; i++) {
        const prevDate = i === 0 ? r.openedDate : (r.updates[i - 1] ? r.updates[i - 1].date : null);
        const currDate = r.updates[i] ? r.updates[i].date : null;
        const key = i === 0 ? `Interval 1 (Opened to 1st Updated)` : `Interval ${i + 1} (${i}th Updated to ${i + 1}th Updated)`;
        if (prevDate && currDate) row[key] = formatInterval(currDate - prevDate);
        else row[key] = '';
      }
      return row;
    });

    return { headers, data };
  }

  async function handleGenerate() {
    if (!fileValid || !inputFile) return;
    setProcessing(true);
    setMessage('Processing and preparing preview...');

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const { rows } = parseWorkbook(workbook);
        const { headers, data: outData } = processRows(rows);
        setAllHeaders(headers);
        setAllRows(outData);
        setTotalRowsCount(outData.length);
        setCurrentPage(1);
        setMessage(`Preview ready — total ${outData.length} rows. Use sorting, filtering and pagination to inspect.`);
      } catch (err) {
        console.error(err);
        setMessage('Error processing file');
        setAllHeaders([]);
        setAllRows([]);
        setTotalRowsCount(0);
      } finally {
        setProcessing(false);
      }
    };
    reader.onerror = () => {
      setProcessing(false);
      setMessage('Failed to read file');
    };
    reader.readAsArrayBuffer(inputFile);
  }

  // Build Excel workbook with real Date cells for date columns
  function buildWorkbookWithDates(headers, rows) {
    // Build AOa: first row headers, then each row values. For date headers, convert strings to Date objects.
    const dateColumns = headers.filter(h => /Opened|Updated/i.test(h));

    const aoa = [headers];
    for (const r of rows) {
      const row = headers.map(h => {
        const v = r[h];
        if (v == null || v === '') return '';
        if (dateColumns.includes(h)) {
          const d = parseToDate(v);
          if (d) return d; // Date object — xlsx will write as date cell
          // sometimes v is ISO string; parseToDate handles it
        }
        // keep intervals & other columns as strings
        return v;
      });
      aoa.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Adjust column widths lightly
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Processed');
    return wb;
  }

  async function handleDownload() {
    if (!fileValid || !inputFile) return;
    setProcessing(true);
    setMessage('Preparing download...');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const { rows } = parseWorkbook(workbook);
        const { headers, data: outData } = processRows(rows);
        const wb = buildWorkbookWithDates(headers, outData);
        const outFileName = (fileName || 'output.xlsx').replace(/\.xlsx$/i, '') + '-processed.xlsx';
        // Write with cellDates true so dates are preserved
        XLSX.writeFile(wb, outFileName, { cellDates: true });
        setMessage(`Downloaded: ${outFileName}`);
      } catch (err) {
        console.error(err);
        setMessage('Error preparing download');
      } finally {
        setProcessing(false);
      }
    };
    reader.onerror = () => {
      setProcessing(false);
      setMessage('Failed to read file');
    };
    reader.readAsArrayBuffer(inputFile);
  }

  // filtering/sorting memo
  const filteredAndSortedRows = useMemo(() => {
    if (!allRows || allRows.length === 0) return [];
    let rows = allRows;
    const gf = (globalFilter || '').trim().toLowerCase();
    if (gf) rows = rows.filter(r => allHeaders.some(h => String(r[h] ?? '').toLowerCase().includes(gf)));

    for (const [col, val] of Object.entries(columnFilters)) {
      if (!val) continue;
      // support special typed filters: date range value like '2025-01-01..2025-01-05' or numeric range '1..5'
      const raw = String(val).trim();
      if (raw.includes('..')) {
        const [a, b] = raw.split('..').map(s => s.trim());
        // try date range
        const da = Date.parse(a);
        const db = Date.parse(b);
        if (!isNaN(da) && !isNaN(db)) {
          rows = rows.filter(r => {
            const v = parseToDate(r[col]);
            if (!v) return false;
            return v >= new Date(da) && v <= new Date(db);
          });
          continue;
        }
        // numeric range
        const na = parseFloat(a);
        const nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) {
          rows = rows.filter(r => {
            const v = parseFloat(String(r[col] || '').replace(/[dhs\s:]/g, ''));
            if (isNaN(v)) return false;
            return v >= na && v <= nb;
          });
          continue;
        }
      }
      // fallback contains
      const v = raw.toLowerCase();
      rows = rows.filter(r => String(r[col] ?? '').toLowerCase().includes(v));
    }

    if (sortKey) {
      const key = sortKey;
      rows = [...rows].sort((a, b) => {
        const A = (a[key] ?? '').toString();
        const B = (b[key] ?? '').toString();
        const dateA = Date.parse(A);
        const dateB = Date.parse(B);
        if (!isNaN(dateA) && !isNaN(dateB)) return sortDir === 'asc' ? dateA - dateB : dateB - dateA;
        const nA = parseFloat(A.replace(/[dhs\s:]/g, ''));
        const nB = parseFloat(B.replace(/[dhs\s:]/g, ''));
        if (!isNaN(nA) && !isNaN(nB)) return sortDir === 'asc' ? nA - nB : nB - nA;
        return sortDir === 'asc' ? A.localeCompare(B) : B.localeCompare(A);
      });
    }
    return rows;
  }, [allRows, allHeaders, globalFilter, columnFilters, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRows.length / pageSize));
  const pageRows = filteredAndSortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setCurrentPage(1);
  }

  // debounced global filter
  function onGlobalFilterChange(v) {
    if (globalFilterTimer.current) clearTimeout(globalFilterTimer.current);
    globalFilterTimer.current = setTimeout(() => { setGlobalFilter(v); setCurrentPage(1); }, 350);
  }

  function onColumnFilterChange(col, v) {
    if (columnFilterTimers.current[col]) clearTimeout(columnFilterTimers.current[col]);
    columnFilterTimers.current[col] = setTimeout(() => { setColumnFilters(prev => ({ ...prev, [col]: v })); setCurrentPage(1); }, 350);
  }

  function clearFilters() {
    setGlobalFilter('');
    setColumnFilters({});
    setCurrentPage(1);
  }

  // Preview table
  function PreviewTable() {
    if (!allHeaders || allHeaders.length === 0) return null;
    return (
      <div style={{ marginTop: 16, opacity: isFadingOut ? 0.35 : 1, transition: 'opacity .28s ease' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <input placeholder="Global search (debounced)..." defaultValue={globalFilter} onChange={e => onGlobalFilterChange(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', minWidth: 240 }} />
          <button onClick={clearFilters} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: '#e6eef0' }}>Clear filters</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: '#475569' }}>Rows per page</div>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: 8, borderRadius: 8 }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e6eef0', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {allHeaders.map(h => (
                  <th key={h} style={{ padding: 8, textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e6eef0', cursor: 'pointer' }} onClick={() => toggleSort(h)}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{h}</span>
                      {sortKey === h ? <small style={{ color: '#0f172a' }}>{sortDir === 'asc' ? '▲' : '▼'}</small> : <small style={{ color: '#94a3b8' }}>⇅</small>}
                    </div>
                  </th>
                ))}
              </tr>
              <tr>
                {allHeaders.map(h => (
                  <th key={h + '-filter'} style={{ padding: '6px 8px', background: '#fff' }}>
                    <input placeholder={`Filter ${h} (use '..' for range)`} defaultValue={columnFilters[h] || ''} onChange={e => onColumnFilterChange(h, e.target.value)} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #eef2f7' }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={allHeaders.length} style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>No rows to display</td></tr>
              ) : (
                pageRows.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {allHeaders.map(h => (
                      <td key={h} style={{ padding: 8, fontSize: 13 }}>{r[h] ?? ''}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <div style={{ color: '#475569' }}>Showing {filteredAndSortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredAndSortedRows.length)} of {filteredAndSortedRows.length} rows (filtered from {totalRowsCount})</div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => { setCurrentPage(1); }} disabled={currentPage === 1} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #e6eef0', background: currentPage === 1 ? '#f8fafc' : 'white' }}>First</button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #e6eef0' }}>Prev</button>
            <span style={{ padding: '6px 8px' }}>Page</span>
            <input value={currentPage} onChange={e => { const v = Number(e.target.value || 1); if (!isNaN(v) && v >= 1 && v <= totalPages) setCurrentPage(v); }} style={{ width: 60, padding: 6, borderRadius: 6, border: '1px solid #e6eef0' }} />
            <span>/ {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #e6eef0' }}>Next</button>
            <button onClick={() => { setCurrentPage(totalPages); }} disabled={currentPage === totalPages} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #e6eef0' }}>Last</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, Roboto, sans-serif', padding: 20 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', boxShadow: '0 6px 20px rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(90deg,#0f172a,#0ea5a4)', color: 'white', padding: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>ERPA - Snow Data Incident Excel Processor</h1>
          <p style={{ marginTop: 6, opacity: 0.95 }}> * Upload the Excel File and this give the Incident Intervals TimeStamps * </p>
        </div>

        <div style={{ background: 'white', padding: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor="file" style={{ padding: '8px 12px', borderRadius: 8, border: '1px dashed #cbd5e1', cursor: 'pointer', background: '#fbfbff' }}>
              Choose File
              <input ref={fileInputRef} id="file" type="file" accept=".xlsx" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>

            <div style={{ minWidth: 260 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{fileName || 'No file chosen'}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{message}</div>
            </div>

            <button onClick={handleGenerate} disabled={!fileValid || processing} style={{ padding: '10px 16px', background: (!fileValid || processing) ? '#e2e8f0' : '#06b6d4', color: (!fileValid || processing) ? '#64748b' : 'white', borderRadius: 8, border: 'none', cursor: (!fileValid || processing) ? 'not-allowed' : 'pointer' }}>
              {processing ? 'Working...' : 'Generate Preview'}
            </button>

            <button onClick={handleDownload} disabled={!fileValid || processing || totalRowsCount === 0} style={{ padding: '10px 16px', background: (!fileValid || processing || totalRowsCount === 0) ? '#f1f5f9' : '#0891b2', color: (!fileValid || processing || totalRowsCount === 0) ? '#94a3b8' : 'white', borderRadius: 8, border: 'none', cursor: (!fileValid || processing || totalRowsCount === 0) ? 'not-allowed' : 'pointer' }}>
              Download Full File
            </button>

            <button onClick={() => setShowConfirmClear(true)} disabled={!(fileValid || allRows.length > 0)} style={{ padding: '10px 16px', background: (fileValid || allRows.length > 0) ? '#ef4444' : '#f8fafc', color: (fileValid || allRows.length > 0) ? 'white' : '#94a3b8', borderRadius: 8, border: 'none', cursor: (fileValid || allRows.length > 0) ? 'pointer' : 'not-allowed' }}>
              Clear / Delete
            </button>

            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#334155' }}>File type</div>
              <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>Only .xlsx  —  Shortcut: Ctrl/Cmd+K</div>
            </div>
          </div>

          <div style={{ marginTop: 18, fontSize: 13, color: '#475569' }}>
            {totalRowsCount > 0 ? (
              <div>Preview available — total {totalRowsCount} rows. Use sorting, filtering and pagination to inspect before downloading.</div>
            ) : (
              <div>Use Generate Preview to inspect output before downloading.</div>
            )}
          </div>

          {/* Preview table with sorting, filtering, pagination */}
          <div>
            <PreviewTable />
          </div>
        </div>

        <div style={{ background: '#0f172a', color: 'white', padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13 }}>ERPA</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Snow Data Incident Excel Processor</div>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirmClear && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,0.5)', zIndex: 60 }}>
          <div style={{ width: 420, background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 10px 40px rgba(2,6,23,0.6)' }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Clear loaded data?</h3>
            <p style={{ marginTop: 8, color: '#475569' }}>This will remove the preview and selected file. You can re-upload a new .xlsx afterwards.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowConfirmClear(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e6eef0', background: 'white' }}>Cancel</button>
              <button onClick={() => { setShowConfirmClear(false); resetAllState(true); }} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#ef4444', color: 'white' }}>Yes, clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
