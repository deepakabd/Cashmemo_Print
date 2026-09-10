const CLOUDINARY_UPLOAD_URL = () =>
  `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`;

export const uploadToCloudinary = async (file, folder) => {
  if (!file) return null;

  const formData = new FormData();
  formData.append("file", file);
  formData.append(
    "upload_preset",
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
  );
  if (folder) formData.append("folder", folder);

  const response = await fetch(CLOUDINARY_UPLOAD_URL(), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Cloudinary upload error:", error);
    throw new Error("Cloudinary upload failed");
  }

  const data = await response.json();
  return data.secure_url;
};

export const uploadEmployeePhoto = async (file, employeeId) => {
  if (!file) return null;
  return uploadToCloudinary(
    file,
    `lpg-dashboard/employee-photos/${employeeId}`,
  );
};
