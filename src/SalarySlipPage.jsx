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

export default function SalarySlipPage({ loggedInUser, onClose }) {
  const [data, setData] = useState(() => loadAttendanceData(loggedInUser));
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [employeeId, setEmployeeId] = useState('');
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
    document.body.classList.add('salary-slip-page-printing');
    window.addEventListener('afterprint', () => document.body.classList.remove('salary-slip-page-printing'), { once: true });
    window.print();
  };
  const profile = employee?.profile || {};
  return <section className="attendance-page salary-slip-page">
    <header className="attendance-hero"><div><p>PAYROLL MENU</p><h1>Salary Slips</h1><span>Open, review and print employee salary slips.</span></div><button className="attendance-close" onClick={onClose}>Back to Attendance</button></header>
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
