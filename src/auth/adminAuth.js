import { adminSignIn as signIn, adminSignOut } from "./userAuth";

export { adminSignOut };

export const adminSignIn = async (loginId, password) => {
  const credential = await signIn(loginId, password);
  try {
    // Refresh so a recently assigned server-side role is not hidden by a
    // cached token. Firestore rules remain the authorization boundary.
    const token = await credential.user.getIdTokenResult(true);
    if (token.claims.role !== 'admin') {
      const error = new Error('This Firebase account does not have the admin role. An authorized administrator must assign its admin custom claim.');
      error.code = 'auth/admin-role-required';
      throw error;
    }
    return credential;
  } catch (error) {
    await adminSignOut().catch(() => {});
    throw error;
  }
};

export const validateAdminCredentials = (loginId, password) => ({
  loginId: String(loginId || "")
    .trim()
    .toLowerCase(),
  password: String(password || "").trim(),
  valid: Boolean(String(loginId || "").trim() && String(password || "").trim()),
});
