import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  window.alert = vi.fn();
  window.confirm = vi.fn(() => true);
});

afterEach(() => {
  cleanup();
});
