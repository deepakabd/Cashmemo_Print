import React, { forwardRef } from 'react';

const FileUpload = forwardRef(({ onFileUpload }, ref) => {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileUpload(file);
      event.target.value = null;
    }
  };

  return <input type="file" accept=".csv, .xlsx" onChange={handleFileChange} ref={ref} style={{ display: 'none' }} />;
});
FileUpload.displayName = 'FileUpload';

export default FileUpload;
