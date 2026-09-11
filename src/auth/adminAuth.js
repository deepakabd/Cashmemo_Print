export { adminSignIn, adminSignOut } from "./userAuth";

export const validateAdminCredentials = (loginId, password) => ({
  loginId: String(loginId || "")
    .trim()
    .toLowerCase(),
  password: String(password || "").trim(),
  valid: Boolean(String(loginId || "").trim() && String(password || "").trim()),
});
