import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getHindiValue, setHindiRuntimeDictionary } from '../src/hindiPrint/index.js';

describe('Hindi print dictionary preference', () => {
  beforeEach(() => {
    setHindiRuntimeDictionary({});
    global.fetch = vi.fn();
  });

  afterEach(() => {
    setHindiRuntimeDictionary({});
    vi.restoreAllMocks();
  });

  it('returns approved dictionary word directly for consumer names', () => {
    setHindiRuntimeDictionary({
      Gaurav: 'गौरव कुमार',
    });

    const result = getHindiValue('Consumer Name', 'Gaurav');

    expect(result).toBe('गौरव कुमार');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns approved dictionary word directly for addresses and areas', () => {
    setHindiRuntimeDictionary({
      'Khera Bazar': 'खेड़ा बाजार',
      Rajesh: 'राजेश',
    });

    expect(getHindiValue('Delivery Area', 'Khera Bazar')).toBe('खेड़ा बाजार');
    expect(getHindiValue('Delivery Man', 'Rajesh')).toBe('राजेश');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
