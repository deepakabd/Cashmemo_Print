import { useEffect, useMemo, useState } from 'react';
import { compressImageFile, loadAttendanceData, loadAttendanceDataFromFirebase, saveAttendanceData, subscribeAttendanceData, uploadAttendanceAsset } from './attendanceStore';
import './Attendance.css';

const blankDraft = { name: '', employeeCode: '', contact: '', designation: '', address: '', wageType: 'Monthly Wage', wageAmount: '', photoDataUrl: '', dob: '', gender: '', bloodGroup: '', emergencyContact: '', currentAddress: '', permanentAddress: '', monthlyBonus: '', advanceInstallment: '', manualDeduction: '', bankAccount: '', ifsc: '', upi: '', pfNumber: '', esiNumber: '' };
const readFileAsDataUrl = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
const withUploadTimeout = (promise, timeout = 12000) => Promise.race([promise, new Promise((_, reject) => window.setTimeout(() => reject(new Error('Upload timed out')), timeout))]);

export default function EmployeeProfilePage({ loggedInUser, onClose }) {
  const [data, setData] = useState(() => loadAttendanceData(loggedInUser));
  const [employeeId, setEmployeeId] = useState('');
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [draft, setDraft] = useState(blankDraft);
  const [profileEditing, setProfileEditing] = useState(false);
  const [message, setMessage] = useState('');
  const employee = data.employees.find((item) => item.id === employeeId);
  const notify = (text) => { setMessage(text); window.setTimeout(() => setMessage(''), 2400); };
  const save = (next) => {
    setData(next);
    try { return saveAttendanceData(loggedInUser, next); } catch { notify('Saved in the current session, but browser storage is full.'); return Promise.resolve(false); }
  };
  const update = (changes) => save({ ...data, employees: data.employees.map((item) => item.id === employeeId ? { ...item, ...changes } : item) });

  useEffect(() => {
    let active = true;
    const apply = (next) => { if (active) setData(next); };
    const unsubscribe = subscribeAttendanceData(loggedInUser, apply);
    loadAttendanceDataFromFirebase(loggedInUser).then(apply);
    return () => { active = false; unsubscribe(); };
  }, [loggedInUser?.id, loggedInUser?.dealerCode, loggedInUser?.dealerName]);

  const selectEmployee = (id) => {
    const selected = data.employees.find((item) => item.id === id);
    setEmployeeId(id);
    setProfileEditing(false);
    setDraft({ ...blankDraft, ...(selected?.profile || {}), name: selected?.name || '', employeeCode: selected?.employeeCode || '', contact: selected?.contact || '', designation: selected?.designation || '', address: selected?.address || '', wageType: selected?.wageType || 'Monthly Wage', wageAmount: selected?.wageAmount || '', photoDataUrl: selected?.photoDataUrl || '', monthlyBonus: selected?.monthlyBonus || '', advanceInstallment: selected?.advanceInstallment || '', manualDeduction: selected?.manualDeduction || '' });
  };
  const saveProfile = () => {
    if (!employee) return;
    const { name, employeeCode, contact, designation, address, wageType, wageAmount, photoDataUrl, ...profileDetails } = draft;
    const history = [...(employee.profileHistory || []), { id: `${Date.now()}`, at: new Date().toISOString(), type: 'Profile and payroll update' }];
    if (!name.trim()) { notify('Employee name is required.'); return; }
    update({ name: name.trim(), employeeCode: employee.employeeCode || employeeCode, contact, designation, address, wageType, wageAmount, photoDataUrl, profile: { ...employee.profile, ...profileDetails }, monthlyBonus: draft.monthlyBonus, advanceInstallment: draft.advanceInstallment, manualDeduction: draft.manualDeduction, profileHistory: history });
    setProfileEditing(false);
    notify('Employee profile and payroll details saved.');
  };
  const handleProfilePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !employee) return;
    if (!file.type.startsWith('image/')) { notify('Please select an image for the employee photo.'); return; }
    if (file.size > 5 * 1024 * 1024) { notify('Employee photo must be under 5 MB.'); return; }
    try {
      const photoDataUrl = await uploadAttendanceAsset(loggedInUser, await compressImageFile(file), 'employee-photos');
      setDraft((current) => ({ ...current, photoDataUrl }));
      notify('Employee photo uploaded. Save profile to apply it.');
    } catch { notify('Photo upload failed. Please try again.'); }
    event.target.value = '';
  };
  const deleteEmployee = () => {
    if (!employee || !window.confirm(`Delete ${employee.name}? This will remove the employee and attendance history.`)) return;
    const records = Object.fromEntries(Object.entries(data.records || {}).map(([day, dayRecords]) => {
      const { [employee.id]: removed, ...remaining } = dayRecords || {};
      return [day, remaining];
    }));
    save({ ...data, employees: data.employees.filter((item) => item.id !== employee.id), records });
    setEmployeeId('');
    setDraft(blankDraft);
    setProfileEditing(false);
    notify('Employee deleted successfully.');
  };
  const toggleEmployeeStatus = () => {
    if (!employee) return;
    const nextActive = employee.active === false;
    update({ active: nextActive });
    notify(nextActive ? 'Employee marked active.' : 'Employee marked inactive.');
  };
  const uploadDocument = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!employee) { notify('Select an employee before uploading a document.'); event.target.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { notify('Please select a document under 5 MB.'); event.target.value = ''; return; }
    notify('Uploading document…');
    let storedUrl = '';
    let savedLocally = false;
    try {
      storedUrl = await withUploadTimeout(uploadAttendanceAsset(loggedInUser, file.type.startsWith('image/') ? await compressImageFile(file) : file, `employee-documents/${employee.id}`));
    } catch {
      try { storedUrl = await readFileAsDataUrl(file); savedLocally = true; } catch { notify('Document could not be read. Please try another file.'); event.target.value = ''; return; }
    }
    update({ documents: [...(employee.documents || []), { id: `${Date.now()}`, name: file.name, type: file.type, dataUrl: storedUrl, uploadedAt: new Date().toISOString(), storageStatus: savedLocally ? 'local' : 'firebase' }] });
    notify(savedLocally ? 'Document saved locally. Firebase Storage unavailable.' : 'Document backed up to Firebase Storage.');
    event.target.value = '';
  };
  const removeDocument = (id) => update({ documents: (employee?.documents || []).filter((document) => document.id !== id) });
  const attendanceStats = useMemo(() => {
    const counts = { Present: 0, Absent: 0, 'Half Day': 0, Leave: 0, 'Paid Leave': 0 };
    Object.entries(data.records || {}).filter(([day]) => day.startsWith(reportMonth)).forEach(([, records]) => { const record = employee ? records[employee.id] : null; if (record?.status in counts) counts[record.status] += 1; });
    const marked = Object.values(counts).reduce((total, value) => total + value, 0);
    const working = counts.Present + counts['Half Day'] * .5;
    return { counts, working, payable: working + counts['Paid Leave'], percentage: marked ? Math.round((counts.Present / marked) * 100) : 0 };
  }, [data.records, employee, reportMonth]);
  const pendingDocuments = employee ? Math.max(0, 3 - (employee.documents || []).length) : 0;

  return <section className={`attendance-page employee-profile-page ${profileEditing ? 'is-editing' : ''}`}>
    <header className="attendance-hero"><div><p>EMPLOYEE DIRECTORY</p><h1>Employee Profile</h1><span>Personal details, payroll, attendance, documents and ID-card readiness.</span></div><button className="attendance-close" onClick={onClose}>Back to Attendance</button></header>
    {message && <div className="attendance-toast">{message}</div>}
    <section className="employee-profile-workspace">
      <label>Select employee<select value={employeeId} onChange={(event) => selectEmployee(event.target.value)}><option value="">Choose employee</option>{data.employees.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.employeeCode || 'No ID'}{item.active === false ? ' · Inactive' : ''}</option>)}</select></label>
      {!employee ? <div className="attendance-empty"><h3>Select an employee</h3><p>Profile dashboard and editable records will appear here.</p></div> : <>
        <div className="employee-profile-summary"><div><span>Employee</span><b>{employee.name}</b></div><div><span>Employee ID</span><b>{employee.employeeCode || 'Pending ID'}</b></div><div><span>Attendance</span><b>{attendanceStats.percentage}% · {attendanceStats.working} payable working</b></div><div><span>Pending documents</span><b>{pendingDocuments ? `${pendingDocuments} pending` : 'Complete'}</b></div></div>
        <div className="profile-section-grid profile-section-grid--wide">
          <section className="profile-section--full"><span className="section-label">EMPLOYEE DETAILS</span><h2>Basic employee details</h2><div className="profile-basic-layout"><div className="employee-profile-photo">{draft.photoDataUrl ? <img src={draft.photoDataUrl} alt={`${employee.name} profile`} /> : <span>{employee.name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'E'}</span>}</div><div className="profile-fields profile-fields--three"><label>Full name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} readOnly={!profileEditing} /></label><label>Employee ID / code<input value={draft.employeeCode} readOnly /></label><label>Contact number<input value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} readOnly={!profileEditing} /></label><label>Designation<input value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} readOnly={!profileEditing} /></label><label className="employee-profile-photo-upload">Employee photo<input type="file" accept="image/*" onChange={handleProfilePhotoChange} disabled={!profileEditing} /><small>Upload a new photo</small></label><label>Address<input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} readOnly={!profileEditing} /></label><label>Wage type<select value={draft.wageType} onChange={(e) => setDraft({ ...draft, wageType: e.target.value })} disabled={!profileEditing}><option>Monthly Wage</option><option>Daily Wage</option></select></label><label>Wage amount<input type="number" min="0" value={draft.wageAmount} onChange={(e) => setDraft({ ...draft, wageAmount: e.target.value })} readOnly={!profileEditing} /></label></div></div></section>
          <section><span className="section-label">PERSONAL & EMPLOYMENT</span><h2>Personal details</h2><div className="profile-fields profile-fields--three"><label>Date of birth<input disabled={!profileEditing} type="date" value={draft.dob} onChange={(e) => setDraft({ ...draft, dob: e.target.value })} readOnly={!profileEditing} /></label><label>Gender<input value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value })} placeholder="Male / Female" readOnly={!profileEditing} /></label><label>Blood group<input value={draft.bloodGroup} onChange={(e) => setDraft({ ...draft, bloodGroup: e.target.value })} placeholder="O+" readOnly={!profileEditing} /></label><label>Emergency contact<input value={draft.emergencyContact} onChange={(e) => setDraft({ ...draft, emergencyContact: e.target.value })} placeholder="Name and mobile" readOnly={!profileEditing} /></label><label>Current address<input value={draft.currentAddress} onChange={(e) => setDraft({ ...draft, currentAddress: e.target.value })} placeholder="Current address" readOnly={!profileEditing} /></label><label>Permanent address<input value={draft.permanentAddress} onChange={(e) => setDraft({ ...draft, permanentAddress: e.target.value })} placeholder="Permanent address" readOnly={!profileEditing} /></label></div></section>
          <section><span className="section-label">BANK & STATUTORY</span><h2>Payroll identity</h2><div className="profile-fields profile-fields--three"><label>Bank account<input value={draft.bankAccount} onChange={(e) => setDraft({ ...draft, bankAccount: e.target.value })} placeholder="Account number" readOnly={!profileEditing} /></label><label>IFSC<input value={draft.ifsc} onChange={(e) => setDraft({ ...draft, ifsc: e.target.value.toUpperCase() })} placeholder="IFSC code" readOnly={!profileEditing} /></label><label>UPI ID<input value={draft.upi} onChange={(e) => setDraft({ ...draft, upi: e.target.value })} placeholder="name@upi" readOnly={!profileEditing} /></label><label>PF number<input value={draft.pfNumber} onChange={(e) => setDraft({ ...draft, pfNumber: e.target.value })} readOnly={!profileEditing} /></label><label>ESI number<input value={draft.esiNumber} onChange={(e) => setDraft({ ...draft, esiNumber: e.target.value })} readOnly={!profileEditing} /></label></div></section>
          <section><span className="section-label">PAYROLL ADJUSTMENTS</span><h2>Salary additions & deductions</h2><div className="profile-fields profile-fields--three"><label>Monthly bonus<input type="number" min="0" value={draft.monthlyBonus} onChange={(e) => setDraft({ ...draft, monthlyBonus: e.target.value })} readOnly={!profileEditing} /></label><label>Loan / advance<input type="number" min="0" value={draft.advanceInstallment} onChange={(e) => setDraft({ ...draft, advanceInstallment: e.target.value })} readOnly={!profileEditing} /></label><label>Other deduction<input type="number" min="0" value={draft.manualDeduction} onChange={(e) => setDraft({ ...draft, manualDeduction: e.target.value })} readOnly={!profileEditing} /></label></div><button className="attendance-primary profile-save" onClick={saveProfile} disabled={!profileEditing}>Save profile & payroll</button></section>
          <section><span className="section-label">ATTENDANCE DASHBOARD</span><h2>Monthly summary</h2><label className="profile-month-picker">Report month<input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} /></label><div className="profile-stat-grid">{Object.entries(attendanceStats.counts).map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}<div><span>Payable days</span><b>{attendanceStats.payable}</b></div></div><p className="profile-help">Late marks, overtime and daily attendance remain available in the Attendance Report.</p></section>
          <section><span className="section-label">DOCUMENT VAULT</span><h2>Employee documents</h2><label className="document-upload">+ Upload Aadhaar, PAN, bank proof or joining document<input type="file" accept="image/*,.pdf" onChange={uploadDocument} /></label><div className="document-list">{(employee.documents || []).length ? employee.documents.map((document) => <div key={document.id}><a href={document.dataUrl} target="_blank" rel="noreferrer">{document.name}</a><button onClick={() => removeDocument(document.id)}>Remove</button></div>) : <p>No documents uploaded yet.</p>}</div></section>
          <section><span className="section-label">ID CARD & HISTORY</span><h2>Verification readiness</h2><div className="profile-stat-grid"><div><span>Photo</span><b>{employee.photoDataUrl ? 'Uploaded' : 'Pending'}</b></div><div><span>Employee QR</span><b>{employee.employeeCode ? 'Ready' : 'Pending ID'}</b></div><div><span>ID card</span><b>{employee.active === false ? 'Inactive' : 'Active'}</b></div><div><span>Updates</span><b>{(employee.profileHistory || []).length}</b></div></div><div className="profile-history">{(employee.profileHistory || []).slice(-4).reverse().map((entry) => <small key={entry.id}>{new Date(entry.at).toLocaleDateString('en-IN')} · {entry.type}</small>)}</div></section>
        </div>
        <div className="employee-profile-actions" aria-label="Employee actions">
          <button type="button" className="profile-action profile-action--edit" onClick={() => { if (profileEditing) selectEmployee(employee.id); else setProfileEditing(true); }}>{profileEditing ? 'Cancel edit' : 'Edit'}</button>
          <button type="button" className="profile-action profile-action--status" onClick={toggleEmployeeStatus}>{employee.active === false ? 'Active' : 'Inactive'}</button>
          <button type="button" className="profile-action profile-action--delete" onClick={deleteEmployee}>Delete</button>
        </div>
      </>}
    </section>
  </section>;
}
