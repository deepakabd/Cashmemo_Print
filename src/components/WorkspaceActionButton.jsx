const paths = {
  create: 'M14 2H6v20h12V6l-4-4Zm0 0v5h5M8 13h8M12 9v8',
  edit: 'm16 3 5 5-12 12-6 1 1-6Zm-2 2 5 5',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  history: 'M3 11a9 9 0 1 1 3 8M3 4v7h7M12 7v5l3 2',
  open: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  share: 'M15 8 9 11m0 2 6 3M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  payment: 'M3 5h18v14H3ZM3 9h18M7 15h3',
  cancel: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM6 6l12 12',
  print: 'M6 9V3h12v6M6 17H4V9h16v8h-2M6 14h12v7H6ZM17 12h1',
  statement: 'M5 3h14v18H5ZM8 7h8M8 11h8M8 15h5',
};

export default function WorkspaceActionButton({ label, icon, ...props }) {
  return <button {...props} type="button" className={`workspace-action-icon workspace-action-icon--${icon}`} aria-label={label} title={label}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[icon]} /></svg>
  </button>;
}
