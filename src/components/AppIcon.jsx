const ICON_PATHS = {
  print: 'M6 9V3h12v6M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
  export: 'M12 3v12m0-12 4 4m-4-4-4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  copy: 'M8 8h11v13H8zM5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1',
  upload: 'M12 21V9m0 0 4 4m-4-4-4 4M5 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2',
  reset: 'M4 12a8 8 0 1 0 2.34-5.66M4 4v6h6',
  save: 'M5 3h12l2 2v16H5zM8 3v6h8M8 17h8',
  filters: 'M3 5h18M6 12h12M10 19h4',
  compact: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
};

const AppIcon = ({ name, className = '' }) => {
  const path = ICON_PATHS[name];
  if (!path) return null;

  return (
    <svg
      className={`app-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
};

export default AppIcon;
