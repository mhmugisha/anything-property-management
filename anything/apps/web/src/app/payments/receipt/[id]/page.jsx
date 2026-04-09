"use client";

import { useEffect, useState } from "react";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { formatDate } from "@/utils/formatDate";

export default function PaymentReceiptPage({ params }) {
  const paymentId = params?.id;

  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const response = await fetch(`/api/payments/${paymentId}/receipt`);
        if (!response.ok) {
          throw new Error("Failed to fetch receipt");
        }
        const data = await response.json();
        setReceipt(data.payment);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (paymentId) {
      fetchReceipt();
    }
  }, [paymentId]);

  useEffect(() => {
    // Auto-trigger print dialog after content loads
    if (receipt && !loading && !error) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [receipt, loading, error]);

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        Loading receipt...
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#ef4444" }}>
        Error: {error || "Receipt not found"}
      </div>
    );
  }

  const allocations = receipt.invoice_allocations || [];
  const isAdvancePayment = allocations.length === 0;

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
          }

          .no-print {
            display: none !important;
          }
        }

        body {
          font-family: 'Courier New', monospace;
          margin: 0;
          padding: 0;
        }
      `}</style>

      <div
        style={{
          width: "80mm",
          margin: "0 auto",
          padding: "10mm 5mm",
          fontSize: "12px",
          lineHeight: "1.4",
          color: "#000",
          backgroundColor: "#fff",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "15px" }}>
          <h1
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              margin: "0 0 5px 0",
              textTransform: "uppercase",
            }}
          >
            PAYMENT RECEIPT
          </h1>
          <div style={{ fontSize: "11px", color: "#333" }}>
            Property Management System
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: "1px dashed #000",
            margin: "10px 0",
          }}
        />

        {/* Receipt Info */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: "bold" }}>Receipt No:</span>
            <span>#{receipt.id}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: "bold" }}>Date:</span>
            <span>{formatDate(receipt.payment_date)}</span>
          </div>
          {receipt.reference_number && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: "bold" }}>Ref:</span>
              <span>{receipt.reference_number}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: "1px dashed #000",
            margin: "10px 0",
          }}
        />

        {/* Tenant Details */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
            TENANT INFORMATION
          </div>
          <div>{receipt.tenant_name || "N/A"}</div>
        </div>

        {/* Property Details */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
            PROPERTY
          </div>
          <div>{receipt.property_name || "N/A"}</div>
          {receipt.unit_number && (
            <div style={{ fontSize: "11px" }}>Unit: {receipt.unit_number}</div>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: "1px dashed #000",
            margin: "10px 0",
          }}
        />

        {/* Payment Details */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
            PAYMENT DETAILS
          </div>

          {/* Payment Method */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Method:</span>
            <span style={{ fontWeight: "bold" }}>{receipt.payment_method}</span>
          </div>

          {/* Description */}
          {receipt.description && (
            <div style={{ marginTop: "5px" }}>
              <div style={{ fontSize: "11px", color: "#333" }}>
                {receipt.description}
              </div>
            </div>
          )}

          {/* Invoice Allocations */}
          {allocations.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                Applied to invoices:
              </div>
              {allocations.map((alloc, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: "10px",
                    marginBottom: "3px",
                    paddingLeft: "5px",
                  }}
                >
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>
                      {alloc.invoice_description ||
                        `Invoice #${alloc.invoice_id}`}
                    </span>
                    <span style={{ fontWeight: "bold" }}>
                      {formatCurrencyUGX(alloc.amount_applied)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payment on Account Notice */}
          {isAdvancePayment && (
            <div
              style={{
                marginTop: "10px",
                padding: "8px",
                backgroundColor: "#f3f4f6",
                fontSize: "11px",
                textAlign: "center",
              }}
            >
              Payment on Account
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: "2px solid #000",
            margin: "10px 0",
          }}
        />

        {/* Total Amount */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "16px",
            fontWeight: "bold",
            marginBottom: "12px",
          }}
        >
          <span>TOTAL PAID:</span>
          <span>{formatCurrencyUGX(receipt.amount)}</span>
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: "2px solid #000",
            margin: "10px 0",
          }}
        />

        {/* Outstanding Balance */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "14px",
            fontWeight: "bold",
            marginBottom: "12px",
          }}
        >
          <span>Balance:</span>
          <span>
            {receipt.outstanding_balance === 0 || !receipt.outstanding_balance
              ? "0"
              : formatCurrencyUGX(receipt.outstanding_balance)}
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: "2px solid #000",
            margin: "10px 0",
          }}
        />

        {/* Notes */}
        {receipt.notes && (
          <div style={{ marginBottom: "12px", fontSize: "11px" }}>
            <div style={{ fontWeight: "bold", marginBottom: "3px" }}>
              Notes:
            </div>
            <div style={{ color: "#333" }}>{receipt.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: "20px",
            textAlign: "center",
            fontSize: "11px",
            color: "#666",
          }}
        >
          <div style={{ marginBottom: "5px" }}>Thank you for your payment!</div>
          {receipt.recorded_by_name && (
            <div style={{ fontSize: "10px" }}>
              Received by: {receipt.recorded_by_name}
            </div>
          )}
          <div style={{ marginTop: "10px", fontSize: "10px" }}>
            Date printed: {formatDate(new Date().toISOString())}
          </div>
        </div>

        {/* Print Button - Only visible on screen */}
        <div
          className="no-print"
          style={{
            marginTop: "20px",
            textAlign: "center",
          }}
        >
          <button
            onClick={() => window.print()}
            style={{
              padding: "10px 20px",
              backgroundColor: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "14px",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Print Receipt
          </button>
          <button
            onClick={() => window.close()}
            style={{
              marginLeft: "10px",
              padding: "10px 20px",
              backgroundColor: "#6b7280",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "14px",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
