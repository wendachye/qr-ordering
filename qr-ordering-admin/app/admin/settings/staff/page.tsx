"use client";

import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { StaffManager } from "@/components/settings/StaffManager";

// Staff accounts + roles (RBAC). Reached via Settings → Staff; the backend gates
// the /admin/staff endpoints on the 'staff:manage' permission.
export default function StaffSettingsPage() {
  return (
    <>
      <SettingsTabs />
      <StaffManager />
    </>
  );
}
