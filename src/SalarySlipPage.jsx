import { useEffect, useMemo, useState } from 'react';
import { loadAttendanceData, loadAttendanceDataFromFirebase, subscribeAttendanceData } from './attendanceStore';
import './Attendance.css';

const toMinutes = (value = '') => {
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  if (match[3]) { hour %= 12; if (match[3].toUpperCase() === 'PM') hour += 12; }
  return hour * 60 + Number(match[2]);
};

export default function SalarySlipPage({ loggedInUser, onClose, initialEmployeeId = '' }) {
  const [data, setData] = useState(() => loadAttendanceData(loggedInUser));
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [shiftSettings, setShiftSettings] = useState(() => loadAttendanceData(loggedInUser).settings?.shift || { start: '09:00', end: '18:00' });
  const employees = (data.employees || []).filter((employee) => employee.active !== false);
  const employee = employees.find((item) => item.id === employeeId) || employees[0] || null;
  const daysInMonth = new Date(Number(reportMonth.slice(0, 4)), Number(reportMonth.slice(5, 7)), 0).getDate();

  useEffect(() => {
    let active = true;
    const apply = (next) => { if (active) { setData(next); setShiftSettings(next.settings?.shift || { start: '09:00', end: '18:00' }); } };
    const unsubscribe = subscribeAttendanceData(loggedInUser, apply);
    loadAttendanceDataFromFirebase(loggedInUser).then(apply);
    return () => { active = false; unsubscribe(); };
  }, [loggedInUser?.id, loggedInUser?.dealerCode, loggedInUser?.dealerName]);

  const row = useMemo(() => {
    if (!employee) return null;
    const counts = { Present: 0, 'Half Day': 0, Absent: 0, Leave: 0, 'Paid Leave': 0 };
    let overtimeMinutes = 0;
    Object.entries(data.records || {}).filter(([day]) => day.startsWith(reportMonth)).forEach(([, records]) => {
      const record = records[employee.id] || {};
      if (record.status in counts) counts[record.status] += 1;
      const checkOut = toMinutes(record.checkOut);
      const shiftEnd = toMinutes(shiftSettings.end);
      if (checkOut !== null && shiftEnd !== null) overtimeMinutes += Math.max(0, checkOut - shiftEnd);
    });
    const workingDays = counts.Present + counts['Half Day'] * .5;
    const payableDays = workingDays + counts['Paid Leave'];
    const rate = Number(employee.wageAmount || 0);
    const grossWage = employee.wageType === 'Daily Wage' ? payableDays * rate : (rate / daysInMonth) * payableDays;
    const hourlyRate = employee.wageType === 'Daily Wage' ? rate / 8 : rate / daysInMonth / 8;
    const overtimePay = Math.max(0, (overtimeMinutes / 60) * hourlyRate);
    const bonus = Number(employee.monthlyBonus || 0);
    const deduction = Number(employee.advanceInstallment || 0) + Number(employee.manualDeduction || 0);
    return { counts, workingDays, payableDays, grossWage, overtimeMinutes, overtimePay, bonus, deduction, wage: Math.max(0, grossWage + overtimePay + bonus - deduction) };
  }, [data.records, employee, reportMonth, daysInMonth, shiftSettings]);

  const printSlip = () => {
    const slip = document.querySelector('.salary-slip-page-card');
    if (!slip) return;
    const printable = slip.cloneNode(true);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Print window blocked hai. Browser me pop-ups allow karke dobara try karein.');
      return;
    }
    printWindow.opener = null;
    printWindow.document.write(`<!doctype html><html><head><title></title><style>
      @page { size: A4 portrait; margin: 12mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; color: #263e58; background: #fff; font-family: Arial, sans-serif; }
      .salary-slip { width: 100%; overflow: hidden; border: 1px solid #cbd9e5; border-radius: 0; background: #fff; }
      .salary-slip > header { display: flex; align-items: flex-start; justify-content: space-between; padding: 18px 20px; color: #fff; background: #10365e; }
      .salary-slip header .section-label { color: #cceaff; font-size: 9px; font-weight: 800; letter-spacing: .1em; }
      .salary-slip header h2 { margin: 4px 0 0; font-size: 20px; }
      .salary-slip header p { margin: 4px 0 0; color: #cceaff; font-size: 11px; }
      .slip-employee { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: #dce6ed; }
      .slip-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin-top: 1px; background: #dce6ed; }
      .slip-employee > div, .slip-grid > div { min-height: 52px; padding: 11px 14px; background: #fff; }
      .slip-employee span, .slip-grid span, .slip-earnings span { display: block; color: #75879a; font-size: 8px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
      .slip-employee b, .slip-grid b { display: block; margin-top: 4px; color: #263e58; font-size: 11px; }
      .slip-earnings { margin: 14px 18px 0; border: 1px solid #dce6ed; }
      .slip-earnings > div { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-bottom: 1px solid #e6edf2; }
      .slip-earnings > div:last-child { border-bottom: 0; }
      .slip-earnings b { color: #263e58; font-size: 11px; }
      .slip-total { display: flex; align-items: center; justify-content: space-between; margin: 14px 18px; padding: 13px 15px; color: #135e40; background: #eaf9f0; }
      .slip-total span { font-size: 11px; font-weight: 700; }
      .slip-total strong { font-size: 20px; }
      .salary-slip footer { display: flex; justify-content: flex-end; padding: 22px 20px 15px; border-top: 1px solid #e2eaf1; }
      .slip-signature { width: 210px; padding-top: 7px; border-top: 1px solid #526779; text-align: center; }
      .slip-signature span { display: block; color: #75879a; font-size: 9px; }
      .slip-signature b { display: block; margin-top: 4px; color: #263e58; font-size: 10px; text-transform: uppercase; }
    </style></head><body>${printable.outerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => printWindow.print(), 100);
  };
  const profile = employee?.profile || {};
  return <section className="attendance-page salary-slip-page">
    <header className="attendance-hero"><div><p>PAYROLL MENU</p><h1>Salary Slips</h1><span>Open, review and print employee salary slips.</span></div></header>
    <section className="salary-slip-page-toolbar"><label>Salary month<input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></label><label>Select employee<select value={employee?.id || ''} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Choose employee</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.employeeCode || 'No ID'}</option>)}</select></label>{employee && <button type="button" className="attendance-primary" onClick={printSlip}>Print salary slip</button>}</section>
    {!employee || !row ? <div className="attendance-empty"><h3>No active employee found</h3><p>Activate an employee in Employee Profile to generate a salary slip.</p></div> : <article className="salary-slip salary-slip-page-card">
      <header><div><span className="section-label">SALARY SLIP</span><h2>{loggedInUser?.dealerName || 'Cashmemo'}</h2><p>{new Date(`${reportMonth}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p></div></header>
      <div className="slip-employee"><div><span>Employee name</span><b>{employee.name}</b></div><div><span>Employee ID</span><b>{employee.employeeCode || '—'}</b></div><div><span>Designation</span><b>{employee.designation || 'Employee'}</b></div><div><span>Wage type</span><b>{employee.wageType || 'Monthly Wage'}</b></div><div><span>Bank account</span><b>{profile.bankAccount || employee.bankAccount || 'Not provided'}</b></div><div><span>IFSC</span><b>{profile.ifsc || employee.ifsc || 'Not provided'}</b></div><div><span>UPI ID</span><b>{profile.upi || employee.upi || 'Not provided'}</b></div></div>
      <div className="slip-grid"><div><span>Total calendar days</span><b>{daysInMonth}</b></div><div><span>Present days</span><b>{row.counts.Present}</b></div><div><span>Half days</span><b>{row.counts['Half Day']}</b></div><div><span>Leave days</span><b>{row.counts.Leave}</b></div><div><span>Paid leave days</span><b>{row.counts['Paid Leave']}</b></div><div><span>Absent days</span><b>{row.counts.Absent}</b></div><div><span>Payable working days</span><b>{row.workingDays}</b></div><div><span>Overtime</span><b>{Math.floor(row.overtimeMinutes / 60)}h {row.overtimeMinutes % 60}m</b></div></div>
      <div className="slip-earnings"><div><span>Basic wage</span><b>₹{row.grossWage.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div><div><span>Overtime pay</span><b>+ ₹{row.overtimePay.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div><div><span>Bonus</span><b>+ ₹{row.bonus.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div><div><span>Total deductions</span><b>− ₹{row.deduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div></div>
      <div className="slip-total"><span>Net payable salary</span><strong>₹{row.wage.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></div><footer><div className="slip-signature"><span>Authorized Signatory</span><b>{loggedInUser?.dealerName || 'Mahadev HP Gas Gramin Vitrak'}</b></div></footer>
    </article>}
  </section>;
}
