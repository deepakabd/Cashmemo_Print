import { useEffect, useMemo, useState } from 'react';
import { loadAttendanceData, loadAttendanceDataFromFirebase, subscribeAttendanceData } from './attendanceStore';
import './Attendance.css';

export default function AttendanceReportPage({ loggedInUser, onClose }) {
  const [data, setData] = useState(() => loadAttendanceData(loggedInUser));
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [employeeScope, setEmployeeScope] = useState('all');
  const daysInMonth = new Date(Number(reportMonth.slice(0, 4)), Number(reportMonth.slice(5, 7)), 0).getDate();

  useEffect(() => {
    let active = true;
    const apply = (next) => { if (active) setData(next); };
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
    Object.entries(data.records || {}).filter(([day]) => day.startsWith(reportMonth)).forEach(([day, records]) => { const status = records[employee.id]?.status || ''; daily[Number(day.slice(-2))] = status; if (status in counts) counts[status] += 1; });
    const workingDays = counts.Present + counts['Half Day'] * .5;
    const attendancePercentage = daysInMonth ? Math.round((counts.Present / daysInMonth) * 100) : 0;
    return { employee, counts, daily, workingDays, attendancePercentage };
  }).filter((row) => statusFilter === 'All' || row.counts[statusFilter] > 0), [data, reportMonth, search, statusFilter, employeeScope]);

  const printReport = () => {
    document.body.classList.add('attendance-report-page-printing');
    window.addEventListener('afterprint', () => document.body.classList.remove('attendance-report-page-printing'), { once: true });
    window.print();
  };
  const statusCode = (status) => status === 'Present' ? 'P' : status === 'Absent' ? 'A' : status === 'Half Day' ? 'H' : status === 'Paid Leave' ? 'PL' : status === 'Leave' ? 'L' : '—';
  return <section className="attendance-page attendance-report-page">
    <header className="attendance-hero"><div><p>PAYROLL REPORT</p><h1>Day-wise Attendance &amp; Wage Report</h1><span>Every date in the selected month is shown employee-wise.</span></div><button className="attendance-close" onClick={onClose}>Back to Attendance</button></header>
    <div className="report-filter-bar"><label>Report month<input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></label><label>Search employee<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, ID or designation" /></label><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option>Present</option><option>Absent</option><option>Leave</option><option>Paid Leave</option><option>Half Day</option></select></label><label>Employees<select value={employeeScope} onChange={(event) => setEmployeeScope(event.target.value)}><option value="all">All employees</option><option value="active">Active only</option><option value="inactive">Inactive only</option></select></label><button className="attendance-primary" onClick={printReport}>Print report</button></div>
    <div className="report-period"><span>{new Date(`${reportMonth}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span><small>Total days: <b>{daysInMonth}</b> · P=Present, A=Absent, H=Half Day, L=Leave, PL=Paid Leave</small><b>{rows.length} employees</b></div>
    <div className="attendance-report-page-sheet attendance-print-sheet"><div className="attendance-print-title"><span>Attendance Sheet {loggedInUser?.dealerName || 'Mahadev HP'}</span><img src="/idlogo.jpg" alt="Dealer logo" /></div><div className="attendance-print-meta"><span><b>Month</b><strong>{new Date(reportMonth + '-01T12:00:00').toLocaleDateString('en-IN', { month: 'long' })}</strong></span><span><b>Year</b><strong>{reportMonth.slice(0, 4)}</strong></span></div><table className="attendance-print-table"><thead><tr><th className="print-sr">Sr</th><th className="print-name">Emp Name</th><th>Attendance%</th><th>Total</th><th>Present</th><th>Working</th><th>Paid leave</th><th>Leave</th><th>Half</th><th>Absent</th>{Array.from({ length: daysInMonth }, (_, index) => <th className="print-day" key={index}>{String(index + 1).padStart(2, '0')}-{new Date(Number(reportMonth.slice(0, 4)), Number(reportMonth.slice(5, 7)) - 1, index + 1).toLocaleDateString('en-US', { month: 'short' })}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.employee.id}><td>{index + 1}</td><td className="print-name-cell">{row.employee.name}</td><td className="print-percent">{row.attendancePercentage}%</td><td>{daysInMonth}</td><td>{row.counts.Present}</td><td>{row.workingDays}</td><td>{row.counts['Paid Leave']}</td><td>{row.counts.Leave}</td><td>{row.counts['Half Day']}</td><td>{row.counts.Absent}</td>{Array.from({ length: daysInMonth }, (_, dayIndex) => <td className={'print-day-cell ' + (statusCode(row.daily[dayIndex + 1]) === 'A' ? 'print-absent' : 'print-present')} key={dayIndex}>{statusCode(row.daily[dayIndex + 1])}</td>)}</tr>)}</tbody></table>{!rows.length && <div className="attendance-empty"><h3>No matching employees</h3><p>Change the report filters and try again.</p></div>}<div className="attendance-print-signature"><span>Authorised Signatory</span><strong>{loggedInUser?.dealerName || loggedInUser?.profileData?.distributorName || 'MAHADEV HP GAS GRAMIN VITRAK'}</strong></div></div>
  </section>;
}
