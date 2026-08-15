import { useMemo, useState } from 'react';
import { loadAttendanceData } from './attendanceStore';
import './Attendance.css';

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'E';
const profileAddress = (user = {}) => user.address || user.profileData?.address || user.profileData?.dealerAddress || '';
const paymentQrSource = (user = {}) => user.paymentProfileData?.qrDataUrl
  || user.paymentProfileData?.qrCodeDataUrl
  || user.paymentProfileData?.qrImageDataUrl
  || user.paymentProfile?.qrDataUrl
  || user.paymentProfile?.qrCodeDataUrl
  || user.paymentQrDataUrl
  || user.profileData?.paymentQrDataUrl
  || '';

function QrArtwork({ compact = false, src = '/hppay.jpg', alt = 'HP Pay QR code' }) {
  return <img className={`id-card-qr ${compact ? 'id-card-qr--compact' : ''}`} src={src} alt={alt} style={{ objectFit: 'cover', objectPosition: 'right' }} />;
}

function CardFront({ employee, businessName, paymentQr }) {
  return <article className="print-id-card print-id-card--front">
    <div className="id-card-brand"><img src="/logo.jpg" alt="HP Gas" /></div>
    <div className="id-card-portrait" aria-label={`${employee.name} photograph`}>{employee.photoDataUrl ? <img src={employee.photoDataUrl} alt={`${employee.name} portrait`} /> : <span>{initials(employee.name)}</span>}</div>
    <div className="id-card-employee-details"><p><b>Name</b><i>:</i><strong>{employee.name}</strong></p><p><b>ID Number</b><i>:</i><strong>{employee.employeeCode || '—'}</strong></p></div>
    {paymentQr ? <QrArtwork src={paymentQr} alt={`${businessName} payment QR code`} /> : <div className="id-card-qr id-card-qr--missing">Payment<br />QR</div>}
    <div className="id-card-payments"><span>UPI</span><span>BHIM</span><span>Paytm</span><span>G Pay</span></div>
    <div className="id-card-authority"><span>Authorised Signatory</span><b>{businessName}</b></div>
  </article>;
}

function CardBack({ businessName, address }) {
  return <article className="print-id-card print-id-card--back">
    <div className="id-card-back-details"><h2>DISTRIBUTORSHIP DETAILS :</h2><b>{businessName}</b>{address && <p>{address}</p>}</div>
    <QrArtwork compact />
    <div className="id-card-app"><span className="id-card-app-logo">HP<br /><small>PAY</small></span><p>Scan QR Code &amp; Download<br />HP PAY Mobile App</p></div>
    <p className="id-card-transfer-note">This card is non-transferable</p>
  </article>;
}

export default function IdCardPage({ loggedInUser, onClose }) {
  const [employees] = useState(() => loadAttendanceData(loggedInUser).employees);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const businessName = loggedInUser?.dealerName || loggedInUser?.profileData?.distributorName || 'Cashmemo';
  const address = profileAddress(loggedInUser);
  const paymentQr = paymentQrSource(loggedInUser);
  const cardsToPrint = useMemo(() => selectedEmployeeId ? employees.filter((employee) => employee.id === selectedEmployeeId) : employees, [employees, selectedEmployeeId]);
  return <section className="attendance-page id-card-page">
    <style>{`.id-card-employee-select{display:grid;width:min(380px,100%);gap:6px;margin:0 0 18px;color:#5d7287;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.id-card-employee-select select{padding:11px 12px;border:1px solid #c9d9e6;border-radius:8px;color:#294b67;background:#fff;font:inherit;font-size:13px;letter-spacing:0;text-transform:none}.id-card-portrait img{width:100%;height:100%;object-fit:cover}.id-card-qr--missing{display:grid;place-items:center;box-sizing:border-box;color:#294887;background:#fff!important;text-align:center;font-size:14px;font-weight:800;line-height:1.15}@media print{.id-card-employee-select{display:none!important}}`}</style>
    <header className="id-card-page-header"><div><p className="attendance-kicker">Employee identity</p><h1>ID Cards</h1><p>Print matching front and reverse sides for every employee.</p></div><div className="id-card-actions"><button type="button" className="attendance-close" onClick={onClose}>← Back to Home</button>{employees.length > 0 && <button type="button" className="attendance-primary" onClick={() => window.print()}>Print cards</button>}</div></header>
    {employees.length === 0 ? <div className="attendance-empty id-card-empty"><h2>No employee cards available</h2><p>Go to Attendance and add employees first.</p></div> : <><label className="id-card-employee-select">Select employee<select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)}><option value="">All employees ({employees.length})</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.employeeCode ? ` · ${employee.employeeCode}` : ''}</option>)}</select></label><div className="id-card-grid">{cardsToPrint.map((employee) => <section className="id-card-set" key={employee.id}><CardFront employee={employee} businessName={businessName} paymentQr={paymentQr} /><CardBack businessName={businessName} address={address} /></section>)}</div></>}
  </section>;
}
