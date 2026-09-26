import { Fragment, useEffect, useMemo, useState } from 'react';
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
const statusCode = (status) => status === 'Present' ? 'P' : status === 'Absent' ? 'A' : status === 'Half Day' ? 'H' : status === 'Paid Leave' ? 'PL' : status === 'Leave' ? 'L' : '—';

export default function EmployeeReportPage({ loggedInUser, onClose, onSalarySlipOpen }) {
  const [data, setData] = useState(() => loadAttendanceData(loggedInUser));
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState('');
  const [employeeScope, setEmployeeScope] = useState('active');
  const [expandedEmployeeId, setExpandedEmployeeId] = useState('');
  const [shiftSettings, setShiftSettings] = useState(() => loadAttendanceData(loggedInUser).settings?.shift || { start: '09:00', end: '18:00' });
  const daysInMonth = new Date(Number(reportMonth.slice(0, 4)), Number(reportMonth.slice(5, 7)), 0).getDate();

  useEffect(() => {
    let active = true;
    const apply = (next) => { if (active) { setData(next); setShiftSettings(next.settings?.shift || { start: '09:00', end: '18:00' }); } };
    const unsubscribe = subscribeAttendanceData(loggedInUser, apply);
    loadAttendanceDataFromFirebase(loggedInUser).then(apply);
    return () => { active = false; unsubscribe(); };
  }, [loggedInUser?.id, loggedInUser?.dealerCode, loggedInUser?.dealerName]);

  const rows = useMemo(() => (data.employees || []).filter((employee) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${employee.name} ${employee.employeeCode || ''} ${employee.designation || ''}`.toLowerCase().includes(query);
    const matchesScope = employeeScope === 'all' || (employeeScope === 'active' ? employee.active !== false : employee.active === false);
    return matchesSearch && matchesScope;
  }).map((employee) => {
    const counts = { Present: 0, 'Half Day': 0, Absent: 0, Leave: 0, 'Paid Leave': 0 };
    const daily = {};
    let overtimeMinutes = 0;
    Object.entries(data.records || {}).filter(([day]) => day.startsWith(reportMonth)).forEach(([day, records]) => {
      const record = records[employee.id] || {};
      daily[Number(day.slice(-2))] = record.status || '';
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
    const wage = Math.max(0, grossWage + overtimePay + bonus - deduction);
    const attendancePercentage = daysInMonth ? Math.round(((counts.Present + counts['Half Day'] * .5) / daysInMonth) * 100) : 0;
    return { employee, counts, daily, workingDays, overtimeMinutes, grossWage, overtimePay, bonus, deduction, wage, attendancePercentage };
  }), [data, reportMonth, daysInMonth, search, employeeScope, shiftSettings]);

  const totals = useMemo(() => rows.reduce((result, row) => ({
    present: result.present + row.counts.Present,
    absent: result.absent + row.counts.Absent,
    halfDay: result.halfDay + row.counts['Half Day'],
    workingDays: result.workingDays + row.workingDays,
    leave: result.leave + row.counts.Leave,
    paidLeave: result.paidLeave + row.counts['Paid Leave'],
    overtimeMinutes: result.overtimeMinutes + row.overtimeMinutes,
    wage: result.wage + row.wage,
  }), { present: 0, absent: 0, halfDay: 0, workingDays: 0, leave: 0, paidLeave: 0, overtimeMinutes: 0, wage: 0 }), [rows]);
  const totalScheduledDays = rows.length * daysInMonth;
  const totalAttendancePercentage = totalScheduledDays ? Math.round(((totals.present + totals.halfDay * .5) / totalScheduledDays) * 100) : 0;
  const businessName = loggedInUser?.dealerName || loggedInUser?.profileData?.distributorName || 'MAHADEV HP GAS GRAMIN VITRAK';
  const printReport = () => {
    const report = document.querySelector('.employee-report-page');
    if (!report) return;
    const printable = report.cloneNode(true);
    printable.querySelectorAll('.attendance-hero, .employee-report-toolbar, .employee-report-detail-row, .employee-report-slip-button').forEach((element) => element.remove());
    printable.querySelectorAll('table tr').forEach((row) => row.lastElementChild?.remove());
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Print window blocked hai. Browser me pop-ups allow karke dobara try karein.');
      return;
    }
    printWindow.opener = null;
    printWindow.document.write(`<!doctype html><html><head><title>Employee Report</title><style>
      @page { size: A4 landscape; margin: 7mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; color: #203b55; background: #fff; font-family: Arial, sans-serif; }
      .employee-report-page { width: 100%; }
      .employee-report-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2mm; margin: 0 0 3mm; }
      .employee-report-summary > div { min-height: 13mm; padding: 2mm; border: .25mm solid #dbe6ef; border-radius: 1.5mm; background: #f8fbfd; }
      .employee-report-summary span { display: block; color: #60758d; font-size: 6pt; font-weight: 700; text-transform: uppercase; }
      .employee-report-summary strong { display: block; margin-top: 1mm; color: #203b55; font-size: 9pt; }
      .employee-report-card { overflow: visible; border: .25mm solid #dbe5ef; border-radius: 0; }
      .employee-report-card__header { display: flex; align-items: center; justify-content: space-between; padding: 2.5mm 3mm; border-bottom: .25mm solid #dbe5ef; }
      .section-label { color: #60758d; font-size: 6pt; font-weight: 700; letter-spacing: .08em; }
      .employee-report-card__header h2 { margin: .8mm 0 0; font-size: 12pt; }
      .employee-report-card__header small { color: #60758d; font-size: 6.5pt; }
      .employee-report-table-wrap { overflow: visible; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      th, td { padding: 1.3mm .7mm; border: .2mm solid #dfe7ed; overflow: hidden; font-size: 5.5pt; line-height: 1.15; text-align: left; overflow-wrap: anywhere; }
      th { color: #365069; background: #eef4f7; font-size: 5.2pt; text-transform: uppercase; }
      th:nth-child(2), td:nth-child(2) { width: 25mm; }
      td strong, td small { display: block; }
      td small { margin-top: .5mm; color: #718397; font-size: 4.8pt; }
      .employee-report-wage { color: #087449; font-weight: 800; }
      .employee-report-signature { display: flex; width: 48mm; margin: 5mm 2mm 0 auto; flex-direction: column; align-items: center; gap: 1mm; break-inside: avoid; text-align: center; }
      .employee-report-signature span { width: 100%; padding-top: 1.5mm; border-top: .3mm solid #203b55; font-size: 7pt; }
      .employee-report-signature strong { font-size: 7pt; text-transform: uppercase; }
      .attendance-empty { padding: 15mm; text-align: center; }
    </style></head><body>${printable.outerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => printWindow.print(), 100);
  };

  return <section className="attendance-page employee-report-page">
    <header className="attendance-hero"><div><p>PAYROLL MENU</p><h1>Employee Report</h1><span>Employee-wise attendance, leave and earned wage summary.</span></div></header>
    <section className="employee-report-toolbar"><label>Report month<input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></label><label>Search employee<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, ID or designation" /></label><label>Employees<select value={employeeScope} onChange={(event) => setEmployeeScope(event.target.value)}><option value="active">Active employees</option><option value="all">All employees</option><option value="inactive">Inactive employees</option></select></label><button type="button" className="attendance-primary employee-report-print-button" onClick={printReport}>Print report</button></section>
    <div className="employee-report-summary"><div><span>Employees</span><strong>{rows.length}</strong></div><div><span>Attendance</span><strong>{totalAttendancePercentage}%</strong></div><div><span>Present</span><strong>{totals.present}</strong></div><div><span>Absent</span><strong>{totals.absent}</strong></div><div><span>Half day</span><strong>{totals.halfDay}</strong></div><div><span>Working days</span><strong>{totals.workingDays}</strong></div><div><span>Leave</span><strong>{totals.leave}</strong></div><div><span>Paid leave</span><strong>{totals.paidLeave}</strong></div><div><span>Overtime</span><strong>{Math.floor(totals.overtimeMinutes / 60)}h {totals.overtimeMinutes % 60}m</strong></div><div><span>Net earned wage</span><strong>₹{totals.wage.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></div></div>
    <section className="employee-report-card"><div className="employee-report-card__header"><div><span className="section-label">MONTHLY WAGE SUMMARY</span><h2>{new Date(`${reportMonth}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2></div><small>Total days: <b>{daysInMonth}</b> · Click an employee row for day-wise detail</small></div>{rows.length ? <div className="employee-report-table-wrap"><table><thead><tr><th>Sr</th><th>Employee name</th><th>Total days</th><th>Present</th><th>Working days</th><th>Attendance %</th><th>Half day</th><th>Leave</th><th>Paid leave</th><th>Overtime</th><th>Gross wage</th><th>Bonus</th><th>Deductions</th><th>Total earned wage</th><th>Action</th></tr></thead><tbody>{rows.map((row, index) => <Fragment key={row.employee.id}><tr className={`employee-report-row ${expandedEmployeeId === row.employee.id ? 'is-expanded' : ''}`} onClick={() => setExpandedEmployeeId((current) => current === row.employee.id ? '' : row.employee.id)}><td>{index + 1}</td><td><strong>{row.employee.name}</strong><small>{row.employee.employeeCode || 'No ID'} · {row.employee.designation || 'Employee'}{row.employee.active === false ? ' · Inactive' : ''}</small></td><td>{daysInMonth}</td><td>{row.counts.Present}</td><td>{row.workingDays}</td><td>{row.attendancePercentage}%</td><td>{row.counts['Half Day']}</td><td>{row.counts.Leave}</td><td>{row.counts['Paid Leave']}</td><td>{Math.floor(row.overtimeMinutes / 60)}h {row.overtimeMinutes % 60}m</td><td>₹{row.grossWage.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td><td>₹{row.bonus.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td><td>₹{row.deduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td><td className="employee-report-wage">₹{row.wage.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td><td>{onSalarySlipOpen && <button type="button" className="employee-report-slip-button" onClick={(event) => { event.stopPropagation(); onSalarySlipOpen(row.employee.id); }}>Salary slip</button>}</td></tr>{expandedEmployeeId === row.employee.id && <tr className="employee-report-detail-row"><td colSpan="15"><div className="employee-report-day-detail"><strong>Day-wise attendance: {row.employee.name}</strong><div>{Array.from({ length: daysInMonth }, (_, dayIndex) => { const day = dayIndex + 1; const code = statusCode(row.daily[day]); return <span className={`employee-report-day employee-report-day--${code.toLowerCase().replace('—', 'empty')}`} key={day}><b>{String(day).padStart(2, '0')}</b><small>{code}</small></span>; })}</div></div></td></tr>}</Fragment>)}</tbody></table></div> : <div className="attendance-empty"><h3>No employees found</h3><p>Change the search or employee filter.</p></div>}</section>
    <div className="employee-report-signature"><span>Authorised Signatory</span><strong>{businessName}</strong></div>
  </section>;
}
