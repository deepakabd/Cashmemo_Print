import {
  getAdminTabAccess,
  resolveAdminRolePermissions,
} from "../src/app/permissions.js";
import { ADMIN_ROLE_PERMISSIONS } from "../src/utils/appConfig.js";

describe("getAdminTabAccess RBAC", () => {
  it("grants the admin role full tab access and mutation", () => {
    const access = getAdminTabAccess("admin");

    expect(access.role).toBe("admin");
    expect(access.canAccessTab("approval")).toBe(true);
    expect(access.canAccessTab("recycle-bin")).toBe(true);
    expect(access.canMutateAdminData).toBe(true);
  });

  it("resolves permissions from the passed role instead of a hardcoded super-admin", () => {
    const viewerAccess = getAdminTabAccess("viewer");

    expect(viewerAccess.canMutateAdminData).toBe(false);
    expect(viewerAccess.canAccessTab("recycle-bin")).toBe(false);
  });

  it("fails closed to view-only when the role is missing", () => {
    const access = getAdminTabAccess();

    expect(access.role).toBe("");
    expect(access.canMutateAdminData).toBe(false);
    expect(access.canAccessTab("recycle-bin")).toBe(false);
    expect(access.canAccessTab("approval")).toBe(false);
  });

  it("fails closed to view-only for an unknown role", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const access = getAdminTabAccess("super-admin");

    expect(access.canMutateAdminData).toBe(false);
    expect(access.canAccessTab("approval")).toBe(false);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("treats a non-string role as missing without throwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => getAdminTabAccess(null)).not.toThrow();
    expect(getAdminTabAccess(undefined).canMutateAdminData).toBe(false);
    expect(getAdminTabAccess({ role: "admin" }).canMutateAdminData).toBe(false);

    warnSpy.mockRestore();
  });

  it("declares exactly one privileged role", () => {
    const privileged = Object.entries(ADMIN_ROLE_PERMISSIONS)
      .filter(([, permissions]) => permissions.mutate)
      .map(([role]) => role);

    expect(privileged).toEqual(["admin"]);
  });

  it("keeps the viewer fallback from being widened to full access", () => {
    const viewer = ADMIN_ROLE_PERMISSIONS.viewer;

    expect(viewer.mutate).toBe(false);
    expect(viewer.tabs).not.toContain("recycle-bin");
    expect(resolveAdminRolePermissions("nope")).toBe(viewer);
  });
});
