import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { MONTH_NAMES, FY_MONTHS, normalizeSalesRows } from '../../utils/salesDataNormalizer';

export default function SalesImportModal({
  isOpen,
  onClose,
  onConfirmImport,
  existingTransactions = [],
  availableYears = [2024, 2025, 2026, 2027, 2028],
  initialUploadType = 'monthWise',
  initialYear = 2026,
  initialMonthCode = '09',
  lockedMonths = {},
  isAdmin = false,
  allowSalesReupload = false,
  uploading = false,
  uploadProgress = 0,
}) {
  const [uploadType, setUploadType] = useState(initialUploadType); // 'monthWise' | 'fyWise'
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonthCode, setSelectedMonthCode] = useState(initialMonthCode);
  const [selectedFy, setSelectedFy] = useState('2026-27');
  const [selectedImportTarget, setSelectedImportTarget] = useState('allRows'); // 'allRows' | 'validOnly'
  const [overwriteMonth, setOverwriteMonth] = useState(true);

  const [selectedFile, setSelectedFile] = useState(null);
  const [reading, setReading] = useState(false);
  const [parseStatus, setParseStatus] = useState(''); // 'Reading Excel...', 'Validating...', etc.
  const [normalizing, setNormalizing] = useState(false);
  const [normalizedResult, setNormalizedResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const fileInputRef = useRef(null);

  // Sync state with incoming props
  useEffect(() => {
    if (isOpen) {
      setUploadType(initialUploadType);
      setSelectedYear(initialYear);
      setSelectedMonthCode(initialMonthCode);
      setOverwriteMonth(true);
      setSelectedFile(null);
      setErrorMsg(null);
      setNormalizedResult(null);
    }
  }, [isOpen, initialUploadType, initialYear, initialMonthCode]);

  if (!isOpen) return null;

  const currentYmKey = `${selectedYear}-${selectedMonthCode}`;
  const now = new Date();
  const realCurrentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonthLocked = currentYmKey !== realCurrentYm && !!lockedMonths[currentYmKey]?.confirmed;
  const canUnlockForReupload = isAdmin || allowSalesReupload;
  const isUploadBlocked = uploadType === 'monthWise' && isCurrentMonthLocked;

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (isUploadBlocked) {
      setErrorMsg(`⚠️ Cannot upload for ${MONTH_NAMES[parseInt(selectedMonthCode, 10) - 1]} ${selectedYear}: This month's data has been confirmed and locked. Admin approval is required.`);
      event.target.value = '';
      return;
    }

    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setErrorMsg('Please select an Excel (.xlsx, .xls) or CSV file.');
      return;
    }

    setSelectedFile(file);
    setErrorMsg(null);
    setReading(true);
    setNormalizedResult(null);

    try {
      setParseStatus('Reading Excel file...');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '', raw: false });

      if (!rawJson || rawJson.length === 0) {
        throw new Error('The selected spreadsheet has no data rows.');
      }

      setParseStatus('Validating 31 columns & dates...');
      const existingKeys = new Set(existingTransactions.map((t) => t.uniqueKey));
      const batchId = `batch_${Date.now()}`;

      const res = normalizeSalesRows(rawJson, {
        sourceFileName: file.name,
        batchId,
        existingUniqueKeys: existingKeys,
        expectedMonth: uploadType === 'monthWise' ? parseInt(selectedMonthCode, 10) : null,
        expectedYear: uploadType === 'monthWise' ? selectedYear : null,
      });

      setParseStatus('Checking duplicates & summarizing...');

      // Check for FY/Month mismatch
      let warning = null;
      if (uploadType === 'monthWise') {
        const expectedYm = `${selectedYear}-${selectedMonthCode}`;
        const hasExpected = res.detectedMonths.includes(expectedYm);
        if (!hasExpected && res.detectedMonths.length > 0) {
          warning = `Note: Selected month is ${MONTH_NAMES[parseInt(selectedMonthCode, 10) - 1]} ${selectedYear}, but Excel predominantly contains dates for: ${res.detectedMonths.join(', ')}.`;
        }
      } else {
        if (!res.detectedFYs.includes(selectedFy) && res.detectedFYs.length > 0) {
          warning = `Note: Selected FY is ${selectedFy}, but file contains dates belonging to: FY ${res.detectedFYs.join(', ')}.`;
        }
      }

      setNormalizedResult({
        ...res,
        batchId,
        fileName: file.name,
        fileSize: file.size,
        warning,
        totalRaw: rawJson.length,
      });
      setParseStatus('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to read file.');
      setNormalizedResult(null);
    } finally {
      setReading(false);
      event.target.value = '';
    }
  };

  const handleConfirm = async () => {
    if (!normalizedResult || isUploadBlocked) return;
    const targetRows = selectedImportTarget === 'allRows'
      ? (normalizedResult.allValidRows || [])
      : (normalizedResult.validRows || []);

    if (!targetRows.length) return;

    const batchRecord = {
      batchId: normalizedResult.batchId,
      fileName: normalizedResult.fileName,
      fileSize: normalizedResult.fileSize,
      uploadType,
      importTarget: selectedImportTarget, // 'allRows' | 'validOnly'
      overwriteMonth,
      fy: uploadType === 'monthWise' ? `${selectedYear}-${String(selectedYear + 1).slice(-2)}` : selectedFy,
      month: uploadType === 'monthWise' ? selectedMonthCode : null,
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'User',
      totalRows: normalizedResult.totalRaw,
      importedRows: targetRows.length,
      duplicateRows: normalizedResult.duplicateRows?.length || 0,
      invalidRows: normalizedResult.invalidRows?.length || 0,
      status: 'completed',
    };

    const saved = await onConfirmImport(batchRecord, targetRows);
    if (saved) onClose();
  };

  return (
    <div className="sales-modal-overlay">
      <div className="sales-modal-container">
        <div className="sales-modal-header">
          <div>
            <h3>📤 Import Sales Excel / CSV</h3>
            <p>Select upload mode, validate schema, detect duplicates, and preview before saving</p>
          </div>
          <button type="button" className="sales-modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="sales-modal-body">
          {/* 1. Upload Type Selection */}
          <div className="import-type-selector">
            <label className={`import-type-option ${uploadType === 'monthWise' ? 'active' : ''}`}>
              <input
                type="radio"
                name="uploadType"
                value="monthWise"
                checked={uploadType === 'monthWise'}
                onChange={() => setUploadType('monthWise')}
              />
              <div>
                <strong>Month-wise Excel</strong>
                <span>e.g. September-2026.xlsx with daily refill records</span>
              </div>
            </label>

            <label className={`import-type-option ${uploadType === 'fyWise' ? 'active' : ''}`}>
              <input
                type="radio"
                name="uploadType"
                value="fyWise"
                checked={uploadType === 'fyWise'}
                onChange={() => setUploadType('fyWise')}
              />
              <div>
                <strong>Financial Year-wise Excel</strong>
                <span>e.g. FY-2026-27.xlsx containing April to March data</span>
              </div>
            </label>
          </div>

          {/* 2. Target Period Selector */}
          <div className="import-period-row">
            {uploadType === 'monthWise' ? (
              <>
                <div className="upload-select-group">
                  <label>Year</label>
                  <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                    {availableYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="upload-select-group">
                  <label>Month</label>
                  <select value={selectedMonthCode} onChange={(e) => setSelectedMonthCode(e.target.value)}>
                    {FY_MONTHS.map((m) => (
                      <option key={m.monthCode} value={m.monthCode}>
                        {m.name} ({m.monthCode})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="upload-select-group">
                <label>Financial Year (April – March)</label>
                <select value={selectedFy} onChange={(e) => setSelectedFy(e.target.value)}>
                  {['2024-25', '2025-26', '2026-27', '2027-28'].map((fy) => (
                    <option key={fy} value={fy}>FY {fy}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Month Lock Notification */}
          {uploadType === 'monthWise' && isCurrentMonthLocked && (
            <div style={{
              margin: '10px 0 14px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: canUnlockForReupload ? '#fef3c7' : '#fee2e2',
              border: `1px solid ${canUnlockForReupload ? '#f59e0b' : '#ef4444'}`,
              color: canUnlockForReupload ? '#92400e' : '#991b1b',
              fontSize: '12.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>{canUnlockForReupload ? '🔑' : '🔒'}</span>
              <span>
                {canUnlockForReupload
                  ? `Month ${currentYmKey} is confirmed & locked. Unlock it from Month-wise Sales Data Uploads before re-uploading.`
                  : `Month ${currentYmKey} is confirmed and locked. Re-uploading is blocked without Admin approval.`}
              </span>
            </div>
          )}

          {/* 3. Drag & Drop File Upload */}
          <div
            className={`sales-import-dropzone ${reading ? 'loading' : ''}`}
            onClick={() => { if (!isUploadBlocked) fileInputRef.current?.click(); }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              disabled={reading || isUploadBlocked}
              onChange={handleFileSelect}
            />
            <div style={{ fontSize: '32px' }}>📊</div>
            <p>
              {reading
                ? parseStatus || 'Analyzing spreadsheet...'
                : selectedFile
                  ? `Selected: ${selectedFile.name}`
                  : 'Click or drop Excel / CSV file here'}
            </p>
            <span>Supports standard 31-column LPG booking, cashmemo, and DAC delivery formats</span>
          </div>

          {errorMsg && <div className="import-error-banner">{errorMsg}</div>}

          {/* 4. Import Preview & Selection Options */}
          {normalizedResult && (
            <div className="import-preview-section">
              {normalizedResult.warning && (
                <div className="import-warning-banner">⚠️ {normalizedResult.warning}</div>
              )}

              {/* SELECTABLE IMPORT TARGET OPTIONS */}
              {(() => {
                const totalCylindersAll = (normalizedResult.allValidRows || []).reduce((s, r) => s + (r.orderQuantity || 1), 0);
                const totalCylindersValid = (normalizedResult.validRows || []).reduce((s, r) => s + (r.orderQuantity || 1), 0);

                return (
                  <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f3756', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>🎯 Choose Import Option:</span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                        Click an option below to select upload mode
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {/* Option 1: Total Rows in File */}
                      <div
                        onClick={() => setSelectedImportTarget('allRows')}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: selectedImportTarget === 'allRows' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: selectedImportTarget === 'allRows' ? '#f0f9ff' : '#ffffff',
                          cursor: 'pointer',
                          boxShadow: selectedImportTarget === 'allRows' ? '0 2px 10px rgba(2,132,199,0.18)' : 'none',
                          transition: 'all 0.2s ease',
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                            <input
                              type="radio"
                              name="importTargetMode"
                              checked={selectedImportTarget === 'allRows'}
                              onChange={() => setSelectedImportTarget('allRows')}
                              style={{ accentColor: '#0284c7', width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: '700', fontSize: '13.5px', color: selectedImportTarget === 'allRows' ? '#0369a1' : '#1e293b' }}>
                              Total Rows in File
                            </span>
                          </label>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            background: selectedImportTarget === 'allRows' ? '#0284c7' : '#e0f2fe',
                            color: selectedImportTarget === 'allRows' ? '#ffffff' : '#0369a1',
                            padding: '2px 8px',
                            borderRadius: '12px',
                          }}>
                            Preserves 2+ Refills
                          </span>
                        </div>

                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#0284c7', margin: '6px 0 3px 24px' }}>
                          {(normalizedResult.allValidRows?.length || normalizedResult.totalRaw || 0).toLocaleString()} Rows
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#0369a1', marginLeft: '6px' }}>
                            ({totalCylindersAll.toLocaleString()} Cylinders)
                          </span>
                        </div>
                        <p style={{ margin: '0 0 0 24px', fontSize: '11px', color: '#475569', lineHeight: '1.35' }}>
                          <strong>All Refill Transactions:</strong> Uploads every refill record in the file. Preserves repeat refills taken by the same consumer in this month.
                        </p>
                      </div>

                      {/* Option 2: Valid & Ready to Import */}
                      <div
                        onClick={() => setSelectedImportTarget('validOnly')}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: selectedImportTarget === 'validOnly' ? '2px solid #10b981' : '1px solid #cbd5e1',
                          background: selectedImportTarget === 'validOnly' ? '#f0fdf4' : '#ffffff',
                          cursor: 'pointer',
                          boxShadow: selectedImportTarget === 'validOnly' ? '0 2px 10px rgba(16,185,129,0.18)' : 'none',
                          transition: 'all 0.2s ease',
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                            <input
                              type="radio"
                              name="importTargetMode"
                              checked={selectedImportTarget === 'validOnly'}
                              onChange={() => setSelectedImportTarget('validOnly')}
                              style={{ accentColor: '#10b981', width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: '700', fontSize: '13.5px', color: selectedImportTarget === 'validOnly' ? '#15803d' : '#1e293b' }}>
                              Valid &amp; Ready to Import
                            </span>
                          </label>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            background: selectedImportTarget === 'validOnly' ? '#10b981' : '#dcfce7',
                            color: selectedImportTarget === 'validOnly' ? '#ffffff' : '#15803d',
                            padding: '2px 8px',
                            borderRadius: '12px',
                          }}>
                            Skip Duplicates
                          </span>
                        </div>

                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#15803d', margin: '6px 0 3px 24px' }}>
                          {(normalizedResult.validRows?.length || 0).toLocaleString()} Rows
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#15803d', marginLeft: '6px' }}>
                            ({totalCylindersValid.toLocaleString()} Cylinders)
                          </span>
                        </div>
                        <p style={{ margin: '0 0 0 24px', fontSize: '11px', color: '#475569', lineHeight: '1.35' }}>
                          <strong>Non-Duplicate Only:</strong> Skips any records that match existing database entries or repeated duplicate keys.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Summary KPI Cards Grid */}
              <div className="import-kpi-grid">
                <div
                  className="import-kpi-card"
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedImportTarget === 'allRows' ? '#0284c7' : '#e2e8f0',
                    background: selectedImportTarget === 'allRows' ? '#f0f9ff' : '#f8fafc',
                  }}
                  onClick={() => setSelectedImportTarget('allRows')}
                  title="Click to select Total Rows in File"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Total Rows in File</span>
                    {selectedImportTarget === 'allRows' && <span style={{ fontSize: '9px', fontWeight: '800', color: '#0284c7' }}>✓ ACTIVE</span>}
                  </div>
                  <strong>{(normalizedResult.allValidRows?.length || normalizedResult.totalRaw || 0).toLocaleString()}</strong>
                </div>

                <div
                  className="import-kpi-card import-kpi-card--green"
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedImportTarget === 'validOnly' ? '#10b981' : '#bbf7d0',
                    background: selectedImportTarget === 'validOnly' ? '#f0fdf4' : '#f0fdf4',
                  }}
                  onClick={() => setSelectedImportTarget('validOnly')}
                  title="Click to select Valid & Ready to Import"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Valid &amp; Ready</span>
                    {selectedImportTarget === 'validOnly' && <span style={{ fontSize: '9px', fontWeight: '800', color: '#15803d' }}>✓ ACTIVE</span>}
                  </div>
                  <strong>{(normalizedResult.validRows?.length || 0).toLocaleString()}</strong>
                </div>

                <div className="import-kpi-card import-kpi-card--yellow">
                  <span>Duplicate Rows Skipped</span>
                  <strong>{(normalizedResult.duplicateRows?.length || 0).toLocaleString()}</strong>
                </div>

                <div className="import-kpi-card import-kpi-card--red">
                  <span>Invalid / Erroneous Rows</span>
                  <strong>{(normalizedResult.invalidRows?.length || 0).toLocaleString()}</strong>
                </div>
              </div>

              {/* Informative alert if any rows had invalid dates */}
              {normalizedResult.invalidRows?.length > 0 && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#991b1b'
                }}>
                  <strong>⚠️ Notice: {normalizedResult.invalidRows.length.toLocaleString()} rows had missing or invalid dates:</strong>
                  <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                    {normalizedResult.invalidRows.slice(0, 3).map((inv, i) => (
                      <li key={i} style={{ marginBottom: '2px' }}>{inv.reason}</li>
                    ))}
                    {normalizedResult.invalidRows.length > 3 && (
                      <li>...and {normalizedResult.invalidRows.length - 3} more.</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Month overwrite option for Month-wise uploads */}
              {uploadType === 'monthWise' && (
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  marginTop: '12px',
                  fontSize: '12px',
                  color: '#334155',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={overwriteMonth}
                    onChange={(e) => setOverwriteMonth(e.target.checked)}
                    style={{ accentColor: '#0284c7', width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <span>
                    <strong>Overwrite existing data for this month:</strong> Replace previous records for {MONTH_NAMES[parseInt(selectedMonthCode, 10) - 1]} {selectedYear} with this file.
                  </span>
                </label>
              )}

              {/* Sample Table Preview */}
              {(() => {
                const activeTargetRows = selectedImportTarget === 'allRows'
                  ? (normalizedResult.allValidRows || [])
                  : (normalizedResult.validRows || []);

                return activeTargetRows.length > 0 ? (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', color: '#0f3756' }}>
                        Sample Rows Preview ({selectedImportTarget === 'allRows' ? 'Total Rows in File' : 'Valid & Ready to Import'} — First 5 of {activeTargetRows.length.toLocaleString()})
                      </h4>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: selectedImportTarget === 'allRows' ? '#0284c7' : '#15803d',
                      }}>
                        Mode: {selectedImportTarget === 'allRows' ? 'All File Rows (Preserves Repeat Refills)' : 'Valid Only (Deduplicated)'}
                      </span>
                    </div>
                    <div className="sales-data-table-wrap">
                      <table className="sales-table">
                        <thead>
                          <tr>
                            <th>Sr</th>
                            <th>Order No</th>
                            <th>CashMemo No</th>
                            <th>Consumer Name</th>
                            <th>Actual Delivery Date</th>
                            <th>DAC Type</th>
                            <th style={{ textAlign: 'center' }}>Qty</th>
                            <th style={{ textAlign: 'right' }}>Sales Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeTargetRows.slice(0, 5).map((r, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>{r.orderNo}</td>
                              <td><strong>{r.cashMemoNo}</strong></td>
                              <td>{r.consumerName}</td>
                              <td>{r.actualDeliveryDate || r.salesDate}</td>
                              <td>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  background: r.dacVerified ? '#dcfce7' : '#fef3c7',
                                  color: r.dacVerified ? '#15803d' : '#b45309'
                                }}>
                                  {r.dacType}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>{r.orderQuantity}</td>
                              <td style={{ textAlign: 'right' }}>₹{r.salesValue.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>

        <div className="sales-modal-footer">
          {uploading && (
            <div className="sales-import-progress" role="status" aria-live="polite">
              <div><strong>Saving to cloud</strong><span>{uploadProgress}%</span></div>
              <progress max="100" value={uploadProgress} />
            </div>
          )}
          <button type="button" className="sales-report-btn" onClick={onClose}>
            Cancel
          </button>
          {(() => {
            const activeTargetRows = normalizedResult
              ? (selectedImportTarget === 'allRows'
                  ? (normalizedResult.allValidRows || [])
                  : (normalizedResult.validRows || []))
              : [];

            const targetLabel = selectedImportTarget === 'allRows' ? 'Total Rows' : 'Valid Rows';

            return (
              <button
                type="button"
                className="sales-report-btn sales-report-btn--primary"
                disabled={!normalizedResult || !activeTargetRows.length || reading || uploading || isUploadBlocked}
                onClick={handleConfirm}
              >
                {uploading
                  ? `Uploading ${uploadProgress}%`
                  : reading
                  ? 'Processing...'
                  : `Confirm & Import ${targetLabel} (${activeTargetRows.length.toLocaleString()} Records)`}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
