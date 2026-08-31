import { describe, expect, it } from "vitest";
import { Permission, StaffRole, hasPermission } from "./enums.js";

describe("staff permission matrix", () => {
  it("keeps campaign creation and approval separated", () => {
    expect(hasPermission([StaffRole.CAMPAIGN_CREATOR], Permission.CREATE_CAMPAIGN)).toBe(true);
    expect(hasPermission([StaffRole.CAMPAIGN_CREATOR], Permission.APPROVE_CAMPAIGN)).toBe(false);
    expect(hasPermission([StaffRole.CAMPAIGN_APPROVER], Permission.APPROVE_CAMPAIGN)).toBe(true);
    expect(hasPermission([StaffRole.CAMPAIGN_APPROVER], Permission.CREATE_CAMPAIGN)).toBe(false);
  });

  it("does not give access managers platform powers", () => {
    expect(hasPermission([StaffRole.ACCESS_MANAGER], Permission.MANAGE_STAFF_ACCESS)).toBe(true);
    expect(hasPermission([StaffRole.ACCESS_MANAGER], Permission.MANAGE_PLATFORM)).toBe(false);
  });

  it("keeps Owner as the sole access-manager delegator", () => {
    expect(hasPermission([StaffRole.ACCESS_MANAGER], Permission.MANAGE_ACCESS_MANAGERS)).toBe(false);
    expect(hasPermission([StaffRole.OWNER], Permission.MANAGE_ACCESS_MANAGERS)).toBe(true);
  });
});
