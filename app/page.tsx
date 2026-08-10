import { Workspace } from "@/components/layout/Workspace";
import { FirstRunSetup } from "@/components/setup/FirstRunSetup";
import { isStorageConfigured } from "@/lib/config/app-config";
import { getOrCreateDefaultUser } from "@/lib/db/queries/user";
import { getWorkspaceBundle } from "@/lib/db/queries/workspace";
import { getAllTags, getAppSettings } from "@/lib/db/queries/config";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isStorageConfigured()) {
    return <FirstRunSetup />;
  }

  const user = await getOrCreateDefaultUser();
  const [spaces, allTags, settings] = await Promise.all([
    getWorkspaceBundle(user.id),
    getAllTags(),
    getAppSettings(),
  ]);
  const firstProjectId = spaces.flatMap((s) => s.projects)[0]?.id ?? null;

  return (
    <Workspace
      initialSpaces={spaces}
      initialActiveProjectId={firstProjectId}
      initialAllTags={allTags}
      initialSettings={settings}
    />
  );
}
