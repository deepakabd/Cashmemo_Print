const BrandMark = ({ size = 'default', className = '' }) => (
  <div className={`brand-mark brand-mark--${size}${className ? ` ${className}` : ''}`}>
    <img src="/branding.png" alt="LPG CashMemo" />
    <span>LPG CashMemo</span>
  </div>
);

export const BrandedLoading = ({ label = 'Loading...' }) => (
  <div className="branded-loading" role="status" aria-live="polite">
    <BrandMark size="loading" />
    <span>{label}</span>
  </div>
);

export const BrandedNotFound = ({ onHome }) => (
  <main className="branded-error-page">
    <BrandMark size="large" />
    <p className="branded-error-page__code">404</p>
    <h1>Page not found</h1>
    <p>The page you are looking for does not exist or has moved.</p>
    <button type="button" onClick={onHome}>Back to home</button>
  </main>
);

export default BrandMark;