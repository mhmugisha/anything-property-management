import { requirePermission } from "@/app/api/utils/staff";
import { discoverAccountingModel } from "@/app/api/utils/cil/discovery";
import { isFeatureEnabled } from "@/app/api/utils/cil/featureFlags";

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const model = await discoverAccountingModel({ force: true });
    const cilEnabled = await isFeatureEnabled("cil_enabled");
    return Response.json({ model, cilEnabled });
  } catch (e) {
    console.error("GET /api/integration/discovery error", e);
    return Response.json({ error: "Failed to run discovery" }, { status: 500 });
  }
}
