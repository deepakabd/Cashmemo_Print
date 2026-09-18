import { useLayoutEffect, useRef } from 'react';

// Keep credentials out of serialized HTML attributes. The browser's live
// input.value still contains typed text and remains accessible to DevTools.
export default function CredentialInput({ value = '', ...props }) {
  const inputRef = useRef(null);
  useLayoutEffect(() => {
    const input = inputRef.current;
    const next = String(value ?? '');
    if (input.value !== next) input.value = next;
  }, [value]);
  return <input {...props} ref={inputRef} />;
}
