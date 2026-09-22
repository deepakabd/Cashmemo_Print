import React from 'react';

/**
 * Unauthorized Access Page
 * Displayed when an active user attempts to access a restricted/disabled menu feature:
 * 1. 👥 HR & WORKFORCE
 * 2. 📦 Inventory Reports
 * 3. 📊 Sales Report
 * 4. 📋 Cashmemo Layout
 * 5. 🧾 INVOICE WORKSPACE
 */
export const UnauthorizedAccessPage = ({
  menuTitle = 'Restricted Feature',
  onClose,
  onContactAdmin,
  adminContacts = [],
}) => {
  return (
    <div
      className="unauthorized-access-page"
      style={{
        minHeight: '75vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
      }}
    >
      <div
        style={{
          maxWidth: '620px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {/* Banner Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            padding: '36px 24px 28px',
            color: '#ffffff',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              fontSize: '36px',
              marginBottom: '16px',
              border: '2px solid rgba(255, 255, 255, 0.4)',
            }}
          >
            🔒
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            Access Restricted
          </h2>
          <div
            style={{
              display: 'inline-block',
              background: 'rgba(0, 0, 0, 0.25)',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            {menuTitle}
          </div>
        </div>

        {/* Message Body */}
        <div style={{ padding: '32px 24px' }}>
          <div
            style={{
              background: '#fff1f2',
              border: '1.5px solid #fecdd3',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
            }}
          >
            <p
              style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#9f1239',
                margin: '0',
                lineHeight: '1.6',
              }}
            >
              You are not authorize to access this page. To enable this page Kindly contact admin.
            </p>
          </div>

          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 28px', lineHeight: '1.5' }}>
            This feature has been currently disabled for your user account.
            When the administrator enables this module in User Access Control, it will become active for you immediately.
          </p>

          {/* Admin Contact Details if available */}
          {adminContacts && adminContacts.length > 0 && (
            <div
              style={{
                background: '#f8fafc',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '24px',
                fontSize: '12px',
                color: '#475569',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: '700', marginBottom: '6px', color: '#0f172a' }}>Admin Contacts:</div>
              {adminContacts.map((c, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>{c.name || 'Administrator'}:</span>
                  <span style={{ fontWeight: '600' }}>{c.phone || c.contact || c.email}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                border: 0,
                borderRadius: '8px',
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              ← Back to Home
            </button>
            {onContactAdmin && (
              <button
                type="button"
                onClick={onContactAdmin}
                style={{
                  background: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                📞 Contact Admin
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedAccessPage;

