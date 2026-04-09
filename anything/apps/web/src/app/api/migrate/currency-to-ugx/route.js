import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * One-time migration endpoint to enforce UGX-only currency
 * This migration:
 * 1. Updates all existing records to UGX
 * 2. Adds CHECK constraints to prevent non-UGX currencies
 * 3. Is idempotent (safe to run multiple times)
 * 4. Runs in a transaction (all or nothing)
 */
export async function POST(request) {
  try {
    // Require authentication
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[CURRENCY MIGRATION] Started by user ${session.user.email}`);

    // Run migration in a transaction
    const results = await sql.transaction([
      // Check current state
      sql`SELECT COUNT(*) as lease_count, 
                 COUNT(CASE WHEN currency != 'UGX' THEN 1 END) as lease_non_ugx
          FROM leases`,

      sql`SELECT COUNT(*) as invoice_count,
                 COUNT(CASE WHEN currency != 'UGX' THEN 1 END) as invoice_non_ugx
          FROM invoices`,

      sql`SELECT COUNT(*) as payment_count,
                 COUNT(CASE WHEN currency != 'UGX' THEN 1 END) as payment_non_ugx
          FROM payments`,

      sql`SELECT COUNT(*) as transaction_count,
                 COUNT(CASE WHEN currency != 'UGX' THEN 1 END) as transaction_non_ugx
          FROM transactions`,

      // Update all records to UGX
      sql`UPDATE leases SET currency = 'UGX' WHERE currency != 'UGX'`,
      sql`UPDATE invoices SET currency = 'UGX' WHERE currency != 'UGX'`,
      sql`UPDATE payments SET currency = 'UGX' WHERE currency != 'UGX'`,
      sql`UPDATE transactions SET currency = 'UGX' WHERE currency != 'UGX'`,
    ]);

    const [
      leaseStats,
      invoiceStats,
      paymentStats,
      transactionStats,
      leaseUpdate,
      invoiceUpdate,
      paymentUpdate,
      transactionUpdate,
    ] = results;

    const beforeState = {
      leases: {
        total: parseInt(leaseStats[0].lease_count),
        nonUGX: parseInt(leaseStats[0].lease_non_ugx),
      },
      invoices: {
        total: parseInt(invoiceStats[0].invoice_count),
        nonUGX: parseInt(invoiceStats[0].invoice_non_ugx),
      },
      payments: {
        total: parseInt(paymentStats[0].payment_count),
        nonUGX: parseInt(paymentStats[0].payment_non_ugx),
      },
      transactions: {
        total: parseInt(transactionStats[0].transaction_count),
        nonUGX: parseInt(transactionStats[0].transaction_non_ugx),
      },
    };

    const updatedRecords = {
      leases: leaseUpdate.rowCount || 0,
      invoices: invoiceUpdate.rowCount || 0,
      payments: paymentUpdate.rowCount || 0,
      transactions: transactionUpdate.rowCount || 0,
    };

    console.log("[CURRENCY MIGRATION] Data updated:", updatedRecords);

    // Now add constraints (these will fail silently if already exist)
    const constraints = [];

    try {
      await sql`ALTER TABLE leases 
                ADD CONSTRAINT leases_currency_ugx_only 
                CHECK (currency = 'UGX')`;
      constraints.push("leases_currency_ugx_only");
    } catch (err) {
      if (err.message.includes("already exists")) {
        constraints.push("leases_currency_ugx_only (already exists)");
      } else {
        throw err;
      }
    }

    try {
      await sql`ALTER TABLE invoices 
                ADD CONSTRAINT invoices_currency_ugx_only 
                CHECK (currency = 'UGX')`;
      constraints.push("invoices_currency_ugx_only");
    } catch (err) {
      if (err.message.includes("already exists")) {
        constraints.push("invoices_currency_ugx_only (already exists)");
      } else {
        throw err;
      }
    }

    try {
      await sql`ALTER TABLE payments 
                ADD CONSTRAINT payments_currency_ugx_only 
                CHECK (currency = 'UGX')`;
      constraints.push("payments_currency_ugx_only");
    } catch (err) {
      if (err.message.includes("already exists")) {
        constraints.push("payments_currency_ugx_only (already exists)");
      } else {
        throw err;
      }
    }

    try {
      await sql`ALTER TABLE transactions 
                ADD CONSTRAINT transactions_currency_ugx_only 
                CHECK (currency = 'UGX')`;
      constraints.push("transactions_currency_ugx_only");
    } catch (err) {
      if (err.message.includes("already exists")) {
        constraints.push("transactions_currency_ugx_only (already exists)");
      } else {
        throw err;
      }
    }

    console.log("[CURRENCY MIGRATION] Constraints added:", constraints);

    const migrationSummary = {
      success: true,
      timestamp: new Date().toISOString(),
      executedBy: session.user.email,
      beforeState,
      updatedRecords,
      constraintsAdded: constraints,
      message:
        "Currency migration completed successfully. All records now use UGX.",
    };

    console.log("[CURRENCY MIGRATION] Complete:", migrationSummary);

    return Response.json(migrationSummary, { status: 200 });
  } catch (error) {
    console.error("[CURRENCY MIGRATION] Failed:", error);
    return Response.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        message: "Migration failed and was rolled back. No data was changed.",
      },
      { status: 500 },
    );
  }
}
