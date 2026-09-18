import { adminSignIn as signIn, adminSignOut } from "./userAuth";

export { adminSignOut };

export const adminSignIn = async (loginId, password) => {
  const credential = await signIn(loginId, password);
  try {
    // Sign-in already issued a fresh token; refresh only if its admin claim is absent.
    let token = await credential.user.getIdTokenResult();
    if (token.claims.role !== 'admin') token = await credential.user.getIdTokenResult(true);
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
