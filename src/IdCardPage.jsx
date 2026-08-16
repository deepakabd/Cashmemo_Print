import { useEffect, useMemo, useState } from 'react';
import { generateEmployeeCode, loadAttendanceData, loadAttendanceDataFromFirebase, subscribeAttendanceData } from './attendanceStore';
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
const automaticEmployeeId = (employee = {}, dealerCode = 'DEALER', sequence = 1) => employee.employeeCode || generateEmployeeCode(employee, dealerCode, [], sequence);

function QrArtwork({ compact = false, src = '/hppay.jpg', alt = 'HP Pay QR code' }) {
  return <img className={`id-card-qr ${compact ? 'id-card-qr--compact' : ''}`} src={src} alt={alt} style={{ objectFit: 'cover', objectPosition: 'right' }} />;
}

function CardFront({ employee, businessName, paymentQr, showPaymentQr, employeeId, photoZoom = 1, isVisitor = false }) {
  return <article className={`print-id-card print-id-card--front ${showPaymentQr ? 'print-id-card--with-qr' : 'print-id-card--normal'}`}>
    <div className="id-card-brand"><img src="/idlogo.jpg" alt="HP Gas" /></div>
    <div className="id-card-portrait" aria-label={`${employee.name} photograph`}>{employee.photoDataUrl ? <img src={employee.photoDataUrl} alt={`${employee.name} portrait`} style={{ transform: `scale(${photoZoom})` }} /> : <span>{initials(employee.name)}</span>}</div>
    <div className="id-card-employee-details"><p><b>Name</b><i>:</i><strong>{employee.name}</strong></p><p><b>ID Number</b><i>:</i><strong>{employeeId}</strong></p>{!showPaymentQr && <p><b>Position</b><i>:</i><strong>{employee.designation || 'Employee'}</strong></p>}</div>
    {showPaymentQr && <>{paymentQr ? <QrArtwork src={paymentQr} alt={`${businessName} payment QR code`} /> : <div className="id-card-qr id-card-qr--missing">Payment<br />QR</div>}<div className="id-card-payments"><img src="/idfront.jpg" alt="Supported payment methods" /></div></>}
    {!showPaymentQr && <div className="id-card-normal-note">{isVisitor ? 'Visitor Identity Card' : 'Employee Identity Card'}</div>}
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
  const [employees, setEmployees] = useState(() => loadAttendanceData(loggedInUser).employees);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [cardType, setCardType] = useState('qr');
  const [photoZoom, setPhotoZoom] = useState(1);
  const [printSize, setPrintSize] = useState('a4');
  const [verificationEmployee, setVerificationEmployee] = useState(null);
  const businessName = loggedInUser?.dealerName || loggedInUser?.profileData?.distributorName || 'Cashmemo';
  const address = profileAddress(loggedInUser);
  const paymentQr = paymentQrSource(loggedInUser);
  const dealerCode = loggedInUser?.dealerCode || loggedInUser?.profileData?.distributorCode || 'DEALER';
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeAttendanceData(loggedInUser, (remoteData) => {
      if (active) setEmployees(remoteData.employees);
    });
    loadAttendanceDataFromFirebase(loggedInUser).then((remoteData) => {
      if (active) setEmployees(remoteData.employees);
    });
    return () => { active = false; unsubscribe(); };
  }, [loggedInUser?.id, loggedInUser?.dealerCode, loggedInUser?.dealerName]);
  const cardsToPrint = useMemo(() => selectedEmployeeIds.length ? employees.filter((employee) => selectedEmployeeIds.includes(employee.id)) : selectedEmployeeId ? employees.filter((employee) => employee.id === selectedEmployeeId) : employees, [employees, selectedEmployeeId, selectedEmployeeIds]);
  const printIdCards = () => {
    document.body.classList.add('id-card-printing');
    const finishPrinting = () => document.body.classList.remove('id-card-printing');
    window.addEventListener('afterprint', finishPrinting, { once: true });
    window.print();
  };
  const openVerification = (employee) => {
    const employeeId = automaticEmployeeId(employee, dealerCode);
    const verificationUrl = `${window.location.origin}${window.location.pathname}?verifyEmployee=${encodeURIComponent(employeeId)}`;
    navigator.clipboard?.writeText(verificationUrl).catch(() => {});
    setVerificationEmployee({ employee, employeeId, verificationUrl });
  };
  const verificationParam = new URLSearchParams(window.location.search).get('verifyEmployee');
  const verifiedEmployee = verificationParam ? employees.find((employee) => automaticEmployeeId(employee, dealerCode) === verificationParam) : null;
  return <section className="attendance-page id-card-page">
    <style>{`.id-card-selectors{display:flex;flex-wrap:wrap;gap:14px;margin:0 0 18px}.id-card-employee-select{display:grid;width:min(380px,100%);gap:6px;color:#5d7287;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.id-card-employee-select select{padding:11px 12px;border:1px solid #c9d9e6;border-radius:8px;color:#294b67;background:#fff;font:inherit;font-size:13px;letter-spacing:0;text-transform:none}.id-card-multi-select select{min-height:74px}.id-card-portrait img{width:100%;height:100%;object-fit:cover;transition:transform .15s ease}.print-id-card--front .id-card-qr{width:101px;height:101px;margin:10px auto 5px}.id-card-payments img{display:block;width:195px;height:40px;object-fit:contain}.print-id-card--front .id-card-authority{position:static;margin:8px 17px 0}.id-card-app img{width:52px;height:52px;object-fit:contain}.id-card-qr--missing{display:grid;place-items:center;box-sizing:border-box;color:#294887;background:#fff!important;text-align:center;font-size:14px;font-weight:800;line-height:1.15}.id-card-normal-note{margin:72px 24px 0;padding:10px;border-top:1px solid rgba(255,255,255,.55);border-bottom:1px solid rgba(255,255,255,.55);text-align:center;font-size:14px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}.id-card-zoom{display:grid;gap:5px;width:180px;color:#5d7287;font-size:11px;font-weight:800;text-transform:uppercase}.id-card-zoom input{accent-color:#176fae}@page{size:A4 portrait;margin:12mm}@media(max-width:650px){.id-card-selectors{display:grid;grid-template-columns:1fr}.id-card-employee-select,.id-card-zoom{width:100%}}@media print{body.id-card-printing .book-view{padding:0!important;background:#fff!important}.id-card-selectors{display:none!important}.id-card-set{width:100%;min-height:273mm;display:block!important}.print-id-card{margin:0 auto!important}}`}</style>
    <style>{`.print-id-card--front .id-card-portrait{position:absolute;top:29px;left:47px;margin:0}.print-id-card--front .id-card-employee-details{position:absolute;top:164px;left:27px;margin:0}.print-id-card--front .id-card-qr{position:absolute;top:218px;left:101px}.print-id-card--front .id-card-payments{position:absolute;top:326px;left:56px;margin:0}.print-id-card--front .id-card-authority{position:absolute;top:378px;right:17px;left:17px;margin:0}.print-id-card--front .id-card-normal-note{position:absolute;top:245px;right:24px;left:24px;margin:0}.print-id-card--front .id-card-normal-note+.id-card-authority{top:337px}`}</style>
    <style>{`.id-card-brand{position:relative;overflow:hidden;border-bottom-left-radius:0;background:#294887}.id-card-brand::before{position:absolute;top:0;left:143px;width:165px;height:61px;border-radius:0 0 0 100% / 0 0 0 150%;content:'';background:#fff}.id-card-brand img{position:relative;z-index:1;width:70px;height:56px;margin-left:228px;object-fit:contain;object-position:center}.print-id-card--with-qr .id-card-payments{top:343px}.print-id-card--with-qr .id-card-authority{top:auto;bottom:32px}.id-card-verify-action{grid-column:1/-1;justify-self:center;padding:8px 12px;border:0;border-radius:7px;color:#17689f;background:#eaf5fc;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.id-card-verification-result{max-width:520px;margin:0 auto 18px;padding:18px;border:1px solid #bfe4d0;border-radius:12px;color:#244d3c;background:#effbf4}.id-card-verification-result span{font-size:10px;font-weight:800;letter-spacing:.08em}.id-card-verification-result h2{margin:5px 0;font-size:20px}.id-card-verification-result p{margin:4px 0;font-size:12px}.id-card-verification-result strong{display:block;margin-top:9px;color:#087348;font-size:12px}.id-card-verification-modal{position:fixed;z-index:4000;inset:0;display:grid;place-items:center;padding:20px;background:rgba(7,28,48,.65)}.id-card-verification-modal section{position:relative;width:min(460px,100%);padding:25px;border-radius:14px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.25)}.id-card-verification-modal button{position:absolute;top:10px;right:12px;border:0;color:#456;background:none;font-size:22px;cursor:pointer}.id-card-verification-modal span{color:#176fae;font-size:10px;font-weight:800;letter-spacing:.08em}.id-card-verification-modal h2{margin:9px 0 4px}.id-card-verification-modal p{margin:0;color:#557087;font-weight:700}.id-card-verification-modal small{display:block;margin:12px 0;padding:10px;overflow:auto;border-radius:6px;background:#f2f6f9;font-size:10px}.id-card-verification-modal strong{color:#087348;font-size:12px}@media print{.id-card-verify-action,.id-card-verification-modal,.id-card-verification-result{display:none!important}}`}</style>
    <style>{`@media print{body:has(.id-card-page) *{visibility:hidden!important}body:has(.id-card-page) .id-card-page,body:has(.id-card-page) .id-card-page *{visibility:visible!important}body:has(.id-card-page) .id-card-page{display:block!important;position:relative!important}}`}</style>
    <style>{`@media print{.id-card-set{display:grid!important;grid-template-columns:repeat(2,308px);gap:14px;align-items:start;justify-content:center;min-height:0!important;padding:0!important;break-inside:avoid;break-after:page}.id-card-set+.id-card-set{break-before:page}.print-id-card--front,.print-id-card--back{break-after:auto!important}}`}</style>
    <style>{`@media print{.id-card-grid--cr80 .id-card-set{grid-template-columns:repeat(2,204px);gap:0}.id-card-grid--cr80 .print-id-card{transform:scale(.66);transform-origin:top left;margin-bottom:-164px!important}}`}</style>
    <header className="id-card-page-header"><div><p className="attendance-kicker">Employee identity</p><h1>ID Cards</h1><p>Print matching front and reverse sides for every employee.</p></div><div className="id-card-actions"><button type="button" className="attendance-close" onClick={onClose}>← Back to Home</button>{employees.length > 0 && <button type="button" className="attendance-primary" onClick={printIdCards}>Print / Save PDF</button>}</div></header>
    {verifiedEmployee && <section className="id-card-verification-result"><span>EMPLOYEE VERIFICATION</span><h2>{verifiedEmployee.name}</h2><p><b>ID:</b> {automaticEmployeeId(verifiedEmployee, dealerCode)}</p><p><b>Position:</b> {verifiedEmployee.designation || 'Employee'}</p><strong>✓ Active employee record</strong></section>}
    {employees.length === 0 ? <div className="attendance-empty id-card-empty"><h2>No employee cards available</h2><p>Go to Attendance and add employees first.</p></div> : <><div className="id-card-selectors"><label className="id-card-employee-select">Select employee<select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)}><option value="">All employees ({employees.length})</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.employeeCode ? ` · ${employee.employeeCode}` : ''}</option>)}</select></label><label className="id-card-employee-select id-card-multi-select">Batch employees (Ctrl/Cmd-select)<select multiple value={selectedEmployeeIds} onChange={(event) => setSelectedEmployeeIds(Array.from(event.target.selectedOptions, (option) => option.value))}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><label className="id-card-employee-select">Front card type<select value={cardType} onChange={(event) => setCardType(event.target.value)}><option value="qr">Front with Payment QR</option><option value="normal">Normal (Without QR)</option><option value="visitor">Visitor Card</option></select></label><label className="id-card-employee-select">Print paper<select value={printSize} onChange={(event) => setPrintSize(event.target.value)}><option value="a4">A4 sheet</option><option value="cr80">CR80 card size</option></select></label><label className="id-card-zoom">Photo crop / zoom <input type="range" min="1" max="1.5" step=".01" value={photoZoom} onChange={(event) => setPhotoZoom(Number(event.target.value))} /></label></div><div className={`id-card-grid id-card-grid--${printSize}`}>{cardsToPrint.map((employee, index) => <section className="id-card-set" key={employee.id}><CardFront employee={employee} businessName={businessName} paymentQr={paymentQr} showPaymentQr={cardType === 'qr'} isVisitor={cardType === 'visitor'} photoZoom={photoZoom} employeeId={automaticEmployeeId(employee, dealerCode, index + 1)} /><CardBack businessName={businessName} address={address} /><button type="button" className="id-card-verify-action" onClick={() => openVerification(employee)}>Copy verification link</button></section>)}</div></>}
    {verificationEmployee && <div className="id-card-verification-modal"><section><button type="button" onClick={() => setVerificationEmployee(null)}>×</button><span>EMPLOYEE VERIFICATION LINK</span><h2>{verificationEmployee.employee.name}</h2><p>{verificationEmployee.employeeId}</p><small>{verificationEmployee.verificationUrl}</small><strong>Link copied. Share it to verify this employee.</strong></section></div>}
  </section>;
}
