import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import CredentialInput from '../src/components/CredentialInput';

it('keeps typed credentials out of HTML attributes and clears the live value on reset', () => {
  function Form() {
    const [pin, setPin] = useState('');
    return <><CredentialInput aria-label="PIN" type="password" value={pin}
      onChange={(event) => setPin(event.target.value)} />
      <button onClick={() => setPin('')}>Clear</button></>;
  }
  render(<Form />);
  const input = screen.getByLabelText('PIN');
  fireEvent.change(input, { target: { value: '123456' } });
  expect(input.value).toBe('123456');
  expect(input.getAttribute('value')).toBeNull();
  expect(input.outerHTML).not.toContain('123456');
  fireEvent.click(screen.getByText('Clear'));
  expect(input.value).toBe('');
});
