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
const automaticEmployeeId = (employee = {}, dealerCode = 'DEALER') => {
  const savedAt = String(employee.id || '').match(/^(\d{13})/);
  const createdOn = savedAt ? new Date(Number(savedAt[1])) : new Date();
  const day = String(createdOn.getDate()).padStart(2, '0');
  const month = String(createdOn.getMonth() + 1).padStart(2, '0');
  const year = String(createdOn.getFullYear()).slice(-2);
  const mobile = String(employee.contact || employee.phone || '').replace(/\D/g, '').slice(-10).padStart(10, '0');
  return `${String(dealerCode).replace(/\s+/g, '').toUpperCase()}${day}${month}${year}${mobile}`;
};

function QrArtwork({ compact = false, src = '/hppay.jpg', alt = 'HP Pay QR code' }) {
  return <img className={`id-card-qr ${compact ? 'id-card-qr--compact' : ''}`} src={src} alt={alt} style={{ objectFit: 'cover', objectPosition: 'right' }} />;
}

function CardFront({ employee, businessName, paymentQr, showPaymentQr, employeeId }) {
  return <article className={`print-id-card print-id-card--front ${showPaymentQr ? 'print-id-card--with-qr' : 'print-id-card--normal'}`}>
    <div className="id-card-brand"><img src="/idlogo.jpg" alt="HP Gas" /></div>
    <div className="id-card-portrait" aria-label={`${employee.name} photograph`}>{employee.photoDataUrl ? <img src={employee.photoDataUrl} alt={`${employee.name} portrait`} /> : <span>{initials(employee.name)}</span>}</div>
    <div className="id-card-employee-details"><p><b>Name</b><i>:</i><strong>{employee.name}</strong></p><p><b>ID Number</b><i>:</i><strong>{employeeId}</strong></p>{!showPaymentQr && <p><b>Position</b><i>:</i><strong>{employee.designation || 'Employee'}</strong></p>}</div>
    {showPaymentQr && <>{paymentQr ? <QrArtwork src={paymentQr} alt={`${businessName} payment QR code`} /> : <div className="id-card-qr id-card-qr--missing">Payment<br />QR</div>}<div className="id-card-payments"><img src="/idfront.jpg" alt="Supported payment methods" /></div></>}
    {!showPaymentQr && <div className="id-card-normal-note">Employee Identity Card</div>}
    <div className="id-card-authority"><span>Authorised Signatory</span><b>{businessName}</b></div>
  </article>;
}

function CardBack({ businessName, address }) {
  return <article className="print-id-card print-id-card--back">
    <div className="id-card-back-details"><h2>DISTRIBUTORSHIP DETAILS :</h2><b>{businessName}</b>{address && <p>{address}</p>}</div>
    <QrArtwork compact />
    <div className="id-card-app"><img src="/idback.jpg" alt="HP Pay" /><p>Scan QR Code &amp; Download<br />HP PAY Mobile App</p></div>
    <p className="id-card-transfer-note">This card is non-transferable</p>
  </article>;
}

export default function IdCardPage({ loggedInUser, onClose }) {
  const [employees] = useState(() => loadAttendanceData(loggedInUser).employees);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [cardType, setCardType] = useState('qr');
  const businessName = loggedInUser?.dealerName || loggedInUser?.profileData?.distributorName || 'Cashmemo';
  const address = profileAddress(loggedInUser);
  const paymentQr = paymentQrSource(loggedInUser);
  const dealerCode = loggedInUser?.dealerCode || loggedInUser?.profileData?.distributorCode || 'DEALER';
  const cardsToPrint = useMemo(() => selectedEmployeeId ? employees.filter((employee) => employee.id === selectedEmployeeId) : employees, [employees, selectedEmployeeId]);
  const printIdCards = () => {
    document.body.classList.add('id-card-printing');
    const finishPrinting = () => document.body.classList.remove('id-card-printing');
    window.addEventListener('afterprint', finishPrinting, { once: true });
    window.print();
  };
  return <section className="attendance-page id-card-page">
    <style>{`.id-card-selectors{display:flex;flex-wrap:wrap;gap:14px;margin:0 0 18px}.id-card-employee-select{display:grid;width:min(380px,100%);gap:6px;color:#5d7287;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.id-card-employee-select select{padding:11px 12px;border:1px solid #c9d9e6;border-radius:8px;color:#294b67;background:#fff;font:inherit;font-size:13px;letter-spacing:0;text-transform:none}.id-card-portrait img{width:100%;height:100%;object-fit:cover}.print-id-card--front .id-card-qr{width:101px;height:101px;margin:10px auto 5px}.id-card-payments img{display:block;width:195px;height:40px;object-fit:contain}.print-id-card--front .id-card-authority{position:static;margin:8px 17px 0}.id-card-app img{width:52px;height:52px;object-fit:contain}.id-card-qr--missing{display:grid;place-items:center;box-sizing:border-box;color:#294887;background:#fff!important;text-align:center;font-size:14px;font-weight:800;line-height:1.15}.id-card-normal-note{margin:72px 24px 0;padding:10px;border-top:1px solid rgba(255,255,255,.55);border-bottom:1px solid rgba(255,255,255,.55);text-align:center;font-size:14px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}@page{size:A4 portrait;margin:12mm}@media print{body.id-card-printing .book-view{padding:0!important;background:#fff!important}.id-card-selectors{display:none!important}.id-card-set{width:100%;min-height:273mm;display:block!important}.print-id-card{margin:0 auto!important}}`}</style>
    <style>{`.print-id-card--front .id-card-portrait{position:absolute;top:29px;left:47px;margin:0}.print-id-card--front .id-card-employee-details{position:absolute;top:164px;left:27px;margin:0}.print-id-card--front .id-card-qr{position:absolute;top:218px;left:101px}.print-id-card--front .id-card-payments{position:absolute;top:326px;left:56px;margin:0}.print-id-card--front .id-card-authority{position:absolute;top:378px;right:17px;left:17px;margin:0}.print-id-card--front .id-card-normal-note{position:absolute;top:245px;right:24px;left:24px;margin:0}.print-id-card--front .id-card-normal-note+.id-card-authority{top:337px}`}</style>
    <style>{`.id-card-brand{position:relative;overflow:hidden;border-bottom-left-radius:0;background:#294887}.id-card-brand::before{position:absolute;top:0;left:143px;width:165px;height:61px;border-radius:0 0 0 100% / 0 0 0 150%;content:'';background:#fff}.id-card-brand img{position:relative;z-index:1;width:70px;height:56px;margin-left:228px;object-fit:contain;object-position:center}.print-id-card--with-qr .id-card-payments{top:343px}.print-id-card--with-qr .id-card-authority{top:auto;bottom:32px}`}</style>
    <style>{`@media print{body:has(.id-card-page) *{visibility:hidden!important}body:has(.id-card-page) .id-card-page,body:has(.id-card-page) .id-card-page *{visibility:visible!important}body:has(.id-card-page) .id-card-page{display:block!important;position:relative!important}}`}</style>
    <style>{`@media print{.id-card-set{display:grid!important;grid-template-columns:repeat(2,308px);gap:14px;align-items:start;justify-content:center;min-height:0!important;padding:0!important;break-inside:avoid;break-after:page}.id-card-set+.id-card-set{break-before:page}.print-id-card--front,.print-id-card--back{break-after:auto!important}}`}</style>
    <header className="id-card-page-header"><div><p className="attendance-kicker">Employee identity</p><h1>ID Cards</h1><p>Print matching front and reverse sides for every employee.</p></div><div className="id-card-actions"><button type="button" className="attendance-close" onClick={onClose}>← Back to Home</button>{employees.length > 0 && <button type="button" className="attendance-primary" onClick={printIdCards}>Print ID Cards</button>}</div></header>
    {employees.length === 0 ? <div className="attendance-empty id-card-empty"><h2>No employee cards available</h2><p>Go to Attendance and add employees first.</p></div> : <><div className="id-card-selectors"><label className="id-card-employee-select">Select employee<select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)}><option value="">All employees ({employees.length})</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.employeeCode ? ` · ${employee.employeeCode}` : ''}</option>)}</select></label><label className="id-card-employee-select">Front card type<select value={cardType} onChange={(event) => setCardType(event.target.value)}><option value="qr">Front with Payment QR</option><option value="normal">Normal (Without QR)</option></select></label></div><div className="id-card-grid">{cardsToPrint.map((employee) => <section className="id-card-set" key={employee.id}><CardFront employee={employee} businessName={businessName} paymentQr={paymentQr} showPaymentQr={cardType === 'qr'} employeeId={automaticEmployeeId(employee, dealerCode)} /><CardBack businessName={businessName} address={address} /></section>)}</div></>}
  </section>;
}
