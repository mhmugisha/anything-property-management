import { requirePermission } from "@/app/api/utils/staff";
import {
  listAccountBindings,
  upsertAccountBinding,
} from "@/app/api/utils/cil/bindings";

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const bindings = await listAccountBindings();
    return Response.json({ bindings });
  } catch (e) {
    console.error("GET /api/integration/bindings error", e);
    return Response.json(
      { error: "Failed to fetch bindings" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();
    const semanticKey = body?.semantic_key;
    const accountId = body?.account_id;

    const result = await upsertAccountBinding({
      semanticKey,
      accountId,
    });

    if (!result.ok) {
      return Response.json(result.body, { status: result.status || 400 });
    }

    return Response.json({ ok: true, binding: result.binding });
  } catch (e) {
    console.error("POST /api/integration/bindings error", e);
    return Response.json(
      { error: "Failed to update binding" },
      { status: 500 },
    );
  }
}
