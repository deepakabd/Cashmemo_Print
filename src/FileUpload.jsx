import React from 'react';

function FileUpload({ onFileUpload }) {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileUpload(file);
      event.target.value = null;
    }
  };

  return <input type="file" accept=".csv, .xlsx" onChange={handleFileChange} />;
}

export default FileUpload;
