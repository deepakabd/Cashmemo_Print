import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnauthorizedAccessPage } from '../src/components/UnauthorizedAccessPage';
import { normalizeUserAccess, MENU_ACCESS_DEFINITIONS } from '../src/components/AdminUserAccessPanel';

describe('User Access Control and UnauthorizedAccessPage', () => {
  it('renders exact unauthorized message and contact admin guidance', () => {
    const onClose = vi.fn();
    const onContactAdmin = vi.fn();

    render(
      <UnauthorizedAccessPage
        menuTitle="📊 Sales Report"
        onClose={onClose}
        onContactAdmin={onContactAdmin}
        adminContacts={[{ phone: '9876543210', name: 'Admin Support' }]}
      />
    );

    // Verify exact required text
    expect(
      screen.getByText('You are not authorize to access this page. To enable this page Kindly contact admin.')
    ).toBeTruthy();

    // Verify menu title
    expect(screen.getByText('📊 Sales Report')).toBeTruthy();

    // Verify action buttons
    const backBtn = screen.getByRole('button', { name: /Back to Home/i });
    fireEvent.click(backBtn);
    expect(onClose).toHaveBeenCalled();

    const contactBtn = screen.getByRole('button', { name: /Contact Admin/i });
    fireEvent.click(contactBtn);
    expect(onContactAdmin).toHaveBeenCalled();
  });

  it('normalizes user access with defaults properly', () => {
    const defaultAccess = normalizeUserAccess({});
    expect(defaultAccess.hrWorkforce).toBe(true);
    expect(defaultAccess.inventoryReports).toBe(true);
    expect(defaultAccess.salesReport).toBe(true);
    expect(defaultAccess.cashmemoLayout).toBe(true);
    expect(defaultAccess.invoiceWorkspace).toBe(true);
    expect(defaultAccess.allowSalesReupload).toBe(false);

    const customAccess = normalizeUserAccess({
      salesReport: false,
      allowSalesReupload: true,
    });
    expect(customAccess.salesReport).toBe(false);
    expect(customAccess.allowSalesReupload).toBe(true);
    expect(customAccess.hrWorkforce).toBe(true);
  });

  it('verifies menu definitions contain all 5 requested menus plus sales re-upload', () => {
    const keys = MENU_ACCESS_DEFINITIONS.map((def) => def.key);
    expect(keys).toContain('hrWorkforce');
    expect(keys).toContain('inventoryReports');
    expect(keys).toContain('salesReport');
    expect(keys).toContain('cashmemoLayout');
    expect(keys).toContain('invoiceWorkspace');
    expect(keys).toContain('allowSalesReupload');
  });
});
