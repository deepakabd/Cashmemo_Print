import React, { useState } from 'react';

function FileUpload({ onFileUpload }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedSuccessfully, setUploadedSuccessfully] = useState(false);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      onFileUpload(file); // Automatically upload the file
      setUploadedSuccessfully(true); // Set to true after successful upload
    } else {
      setSelectedFile(null);
      setUploadedSuccessfully(false);
    }
  };



  return (
    <div>
      {!uploadedSuccessfully ? (
        <>
          <input type="file" accept=".csv, .xlsx" onChange={handleFileChange} />
          {selectedFile && <p>Selected File: {selectedFile.name}</p>}
        </>
      ) : (
        <p>File uploaded successfully!</p>
      )}
    </div>
  );
}

export default FileUpload;
