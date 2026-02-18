import React, { useState } from 'react';

function FileUpload({ onFileUpload }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedSuccessfully, setUploadedSuccessfully] = useState(false);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setUploadedSuccessfully(false); // Reset on new file selection
  };

  const handleUpload = () => {
    if (selectedFile) {
      onFileUpload(selectedFile);
      setUploadedSuccessfully(true); // Set to true after successful upload
    } else {
      alert('Please select a file to upload.');
    }
  };

  return (
    <div>
      {!uploadedSuccessfully ? (
        <>
          <input type="file" accept=".csv, .xlsx" onChange={handleFileChange} />
          <button onClick={handleUpload} disabled={!selectedFile} style={{ backgroundColor: 'white', color: 'black' }}>
            Upload File
          </button>
          {selectedFile && <p>Selected File: {selectedFile.name}</p>}
        </>
      ) : (
        <p>File uploaded successfully!</p>
      )}
    </div>
  );
}

export default FileUpload;
