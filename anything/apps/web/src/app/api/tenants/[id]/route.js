import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

const ALLOWED_TITLES = new Set(["Mr.", "Ms.", "Dr."]);

export async function GET(request, { params: { id } }) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const tenantId = Number(id);
    if (!tenantId) {
      return Response.json({ error: "Invalid tenant id" }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, title, full_name, phone, email, national_id, emergency_contact, emergency_phone, status, created_at
      FROM tenants
      WHERE id = ${tenantId}
      LIMIT 1
    `;

    const tenant = rows?.[0] || null;
    return Response.json({ tenant });
  } catch (error) {
    console.error("GET /api/tenants/[id] error", error);
    return Response.json({ error: "Failed to fetch tenant" }, { status: 500 });
  }
}

export async function PUT(request, { params: { id } }) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const tenantId = Number(id);
    if (!tenantId) {
      return Response.json({ error: "Invalid tenant id" }, { status: 400 });
    }

    const existingRows =
      await sql`SELECT * FROM tenants WHERE id = ${tenantId} LIMIT 1`;
    const existing = existingRows?.[0] || null;
    if (!existing) {
      return Response.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();

    const rawTitle =
      typeof body?.title === "string" ? body.title.trim() : undefined;
    const title =
      rawTitle === undefined
        ? undefined
        : rawTitle
          ? ALLOWED_TITLES.has(rawTitle)
            ? rawTitle
            : null
          : null;

    const fullName =
      typeof body?.full_name === "string" ? body.full_name.trim() : undefined;
    const phone =
      typeof body?.phone === "string" ? body.phone.trim() : undefined;
    const email =
      typeof body?.email === "string" ? body.email.trim() : undefined;
    const nationalId =
      typeof body?.national_id === "string"
        ? body.national_id.trim()
        : undefined;
    const emergencyContact =
      typeof body?.emergency_contact === "string"
        ? body.emergency_contact.trim()
        : undefined;
    const emergencyPhone =
      typeof body?.emergency_phone === "string"
        ? body.emergency_phone.trim()
        : undefined;
    const status =
      typeof body?.status === "string" ? body.status.trim() : undefined;

    const next = {
      title: title !== undefined ? title : existing.title,
      full_name: fullName !== undefined ? fullName : existing.full_name,
      phone: phone !== undefined ? phone : existing.phone,
      email: email !== undefined ? email || null : existing.email,
      national_id:
        nationalId !== undefined ? nationalId || null : existing.national_id,
      emergency_contact:
        emergencyContact !== undefined
          ? emergencyContact || null
          : existing.emergency_contact,
      emergency_phone:
        emergencyPhone !== undefined
          ? emergencyPhone || null
          : existing.emergency_phone,
      status: status !== undefined ? status : existing.status,
    };

    if (!next.full_name || !next.phone) {
      return Response.json(
        { error: "full_name and phone are required" },
        { status: 400 },
      );
    }

    const updatedRows = await sql`
      UPDATE tenants
      SET title = ${next.title},
          full_name = ${next.full_name},
          phone = ${next.phone},
          email = ${next.email},
          national_id = ${next.national_id},
          emergency_contact = ${next.emergency_contact},
          emergency_phone = ${next.emergency_phone},
          status = ${next.status}
      WHERE id = ${tenantId}
      RETURNING id, title, full_name, phone, email, national_id, emergency_contact, emergency_phone, status, created_at
    `;

    const tenant = updatedRows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "tenant.update",
      entityType: "tenant",
      entityId: tenantId,
      oldValues: existing,
      newValues: tenant,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ tenant });
  } catch (error) {
    console.error("PUT /api/tenants/[id] error", error);
    return Response.json({ error: "Failed to update tenant" }, { status: 500 });
  }
}

export async function DELETE(request, { params: { id } }) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const tenantId = Number(id);
    if (!tenantId) {
      return Response.json({ error: "Invalid tenant id" }, { status: 400 });
    }

    const existingRows = await sql`
      SELECT id, title, full_name, phone, email, national_id, emergency_contact, emergency_phone, status, created_at
      FROM tenants
      WHERE id = ${tenantId}
      LIMIT 1
    `;

    const existing = existingRows?.[0] || null;
    if (!existing) {
      return Response.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Gather related IDs first (so we can run a safe, ordered delete).
    const leaseRows = await sql`
      SELECT id, unit_id
      FROM leases
      WHERE tenant_id = ${tenantId}
    `;

    const leaseIds = (leaseRows || []).map((r) => Number(r.id)).filter(Boolean);
    const unitIds = (leaseRows || [])
      .map((r) => Number(r.unit_id))
      .filter(Boolean);

    const paymentRows = await sql`
      SELECT id
      FROM payments
      WHERE tenant_id = ${tenantId}
    `;
    const paymentIds = (paymentRows || [])
      .map((r) => Number(r.id))
      .filter(Boolean);

    const invoiceRows = await sql`
      SELECT id
      FROM invoices
      WHERE tenant_id = ${tenantId}
    `;
    const invoiceIds = (invoiceRows || [])
      .map((r) => Number(r.id))
      .filter(Boolean);

    // Use the platform-supported sql.transaction() array style.
    await sql.transaction((txn) => [
      // 1) allocations (depends on payments + invoices)
      paymentIds.length > 0 || invoiceIds.length > 0
        ? txn(
            `
            DELETE FROM payment_invoice_allocations
            WHERE ($1::int[] IS NOT NULL AND payment_id = ANY($1::int[]))
               OR ($2::int[] IS NOT NULL AND invoice_id = ANY($2::int[]))
          `,
            [
              paymentIds.length ? paymentIds : null,
              invoiceIds.length ? invoiceIds : null,
            ],
          )
        : txn`SELECT 1`,

      // 2) payments
      paymentIds.length > 0
        ? txn(`DELETE FROM payments WHERE id = ANY($1::int[])`, [paymentIds])
        : txn`SELECT 1`,

      // 3) invoices
      invoiceIds.length > 0
        ? txn(`DELETE FROM invoices WHERE id = ANY($1::int[])`, [invoiceIds])
        : txn`SELECT 1`,

      // 4) maintenance + deductions
      txn(`DELETE FROM maintenance_requests WHERE tenant_id = $1`, [tenantId]),
      txn(`DELETE FROM tenant_deductions WHERE tenant_id = $1`, [tenantId]),

      // 5) leases
      leaseIds.length > 0
        ? txn(`DELETE FROM leases WHERE id = ANY($1::int[])`, [leaseIds])
        : txn`SELECT 1`,

      // 6) mark units vacant
      unitIds.length > 0
        ? txn(`UPDATE units SET status = 'vacant' WHERE id = ANY($1::int[])`, [
            unitIds,
          ])
        : txn`SELECT 1`,

      // 7) tenant
      txn(`DELETE FROM tenants WHERE id = $1`, [tenantId]),
    ]);

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "tenant.delete",
      entityType: "tenant",
      entityId: tenantId,
      oldValues: existing,
      newValues: null,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/tenants/[id] error", error);
    return Response.json({ error: "Failed to delete tenant" }, { status: 500 });
  }
}
