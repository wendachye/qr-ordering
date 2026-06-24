"use client";

import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { TrashManager } from "@/components/settings/TrashManager";

// Settings → Trash: soft-deleted catalog/config records + restore. Reached via
// Settings → Trash; the backend gates /admin/trash on the 'settings:manage'
// permission (owner / manager), so cashiers/waiters never see this area.
export default function TrashSettingsPage() {
  return (
    <>
      <SettingsTabs />
      <TrashManager />
    </>
  );
}
