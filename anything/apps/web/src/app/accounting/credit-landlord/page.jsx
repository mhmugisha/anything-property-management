"use client";

import { useCallback, useState, useMemo, useEffect } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { useAccountingLookups } from "@/hooks/useAccountingLookups";
import { useCreditLandlord } from "@/hooks/useReconciliation";
import { Save, Search, X } from "lucide-react";
import DatePopoverInput from "@/components/DatePopoverInput";
import { Field } from "@/components/Accounting/Field";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function CreditLandlordPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;
  const isAdmin = staffQuery.data?.role_name === "Admin";

  const [landlordId, setLandlordId] = useState("");
  const [landlordSearch, setLandlordSearch] = useState("");
  const [showLandlordDropdown, setShowLandlordDropdown] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [date, setDate] = useState(todayYmd);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");

  const lookups = useAccountingLookups(!userLoading && !!user && canUseAccounting);

  const creditLandlordMutation = useCreditLandlord();

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (creditLandlordMutation.error) {
      const timer = setTimeout(() => creditLandlordMutation.reset(), 3000);
      return () => clearTimeout(timer);
    }
  }, [creditLandlordMutation.error, creditLandlordMutation]);

  const filteredLandlords = useMemo(() => {
    const all = lookups.landlords || [];
    if (!landlordSearch.trim()) return all;
    const lower = landlordSearch.toLowerCase();
    return all.filter((l) => (l.full_name || "").toLowerCase().includes(lower));
  }, [lookups.landlords, landlordSearch]);

  const filteredProperties = useMemo(() => {
    if (!landlordId) return [];
    return (lookups.properties || []).filter(
      (p) => String(p.landlord_id) === String(landlordId),
    );
  }, [lookups.properties, landlordId]);

  const onSelectLandlord = useCallback(
    (landlord) => {
      const title = landlord.title ? `${landlord.title} ` : "";
      setLandlordId(String(landlord.id));
      setLandlordSearch(`${title}${landlord.full_name}`);
      setShowLandlordDropdown(false);
      setPropertyId("");
    },
    [],
  );

  const onClearLandlord = useCallback(() => {
    setLandlordId("");
    setLandlordSearch("");
    setPropertyId("");
  }, []);

  const canPost =
    !!landlordId && !!date && !!description.trim() && !!amount && Number(amount) > 0;

  const onSubmit = useCallback(() => {
    setSuccessMessage(null);
    creditLandlordMutation.reset();

    creditLandlordMutation.mutate(
      {
        landlord_id: Number(landlordId),
        property_id: propertyId ? Number(propertyId) : null,
        amount: Number(amount),
        description: description.trim(),
        transaction_date: date,
        reference_number: referenceNumber.trim() || null,
      },
      {
        onSuccess: () => {
          setDescription("");
          setAmount("");
          setReferenceNumber("");
          setSuccessMessage("Landlord credit posted successfully!");
        },
      },
    );
  }, [landlordId, propertyId, date, description, amount, referenceNumber, creditLandlordMutation]);

  const isLoading = userLoading || staffQuery.isLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/account/signin";
    return null;
  }

  if (!staffQuery.data) {
    if (typeof window !== "undefined") window.location.href = "/onboarding";
    return null;
  }

  if (!canUseAccounting) {
    return (
      <AccessDenied
        title="Credit Landlord"
        message="You don't have access to the accounting module."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AccessDenied
        title="Credit Landlord"
        message="Admin access required to post landlord credits."
      />
    );
  }

  const landlordDropdownVisible = showLandlordDropdown && filteredLandlords.length > 0;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Credit Landlord"
        onMenuToggle={() => setMobileMenuOpen(true)}
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="accounting"
      />
      <Sidebar active="accounting">
        <AccountingSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className="p-4 md:p-6 max-w-[90%] mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-slate-800">
              Credit Landlord
            </h1>
            <p className="text-slate-500 mt-2">
              Post a manual credit to a landlord&apos;s account (Dr 3200 / Cr 2100)
            </p>
          </div>

          <div className="max-w-[960px] mx-auto bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="bg-gray-50 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-slate-800 mb-6 text-center">
                New Landlord Credit
              </h3>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Landlord">
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={landlordSearch}
                          onChange={(e) => {
                            setLandlordSearch(e.target.value);
                            setShowLandlordDropdown(true);
                            if (!e.target.value.trim()) onClearLandlord();
                          }}
                          onFocus={() => setShowLandlordDropdown(true)}
                          placeholder="Search landlord by name…"
                          className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                        />
                        {landlordId && (
                          <button
                            type="button"
                            onClick={onClearLandlord}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {landlordDropdownVisible && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                          {filteredLandlords.map((l) => {
                            const title = l.title ? `${l.title} ` : "";
                            const label = `${title}${l.full_name}`;
                            return (
                              <button
                                key={l.id}
                                type="button"
                                onClick={() => onSelectLandlord(l)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 ${
                                  String(l.id) === landlordId ? "bg-sky-50 font-medium" : ""
                                }`}
                              >
                                <div className="font-medium text-slate-800">{label}</div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Field>

                  <Field label="Property (Optional)">
                    <select
                      value={propertyId}
                      onChange={(e) => setPropertyId(e.target.value)}
                      disabled={!landlordId}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none disabled:bg-gray-100 disabled:text-slate-500"
                    >
                      <option value="">
                        {!landlordId ? "Select landlord first…" : "All properties"}
                      </option>
                      {filteredProperties.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.property_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Amount (UGX)">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    />
                  </Field>

                  <Field label="Date">
                    <DatePopoverInput
                      value={date}
                      onChange={setDate}
                      placeholder="DD-MM-YYYY"
                      className="bg-white"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Description">
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Correction for overpaid management fees"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    />
                  </Field>

                  <Field label="Reference (Optional)">
                    <input
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="e.g. REF-001"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    />
                  </Field>
                </div>
              </div>

              {landlordDropdownVisible && (
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowLandlordDropdown(false)}
                />
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={onSubmit}
                  disabled={creditLandlordMutation.isPending || !canPost}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {creditLandlordMutation.isPending ? "Posting..." : "Post Credit"}
                </button>
              </div>

              <div className="mt-4 text-xs text-slate-500 text-center">
                Posts Dr 3200 Retained Earnings / Cr 2100 Due to Landlords
              </div>
            </div>
          </div>

          {successMessage ? (
            <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          {creditLandlordMutation.error ? (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {creditLandlordMutation.error?.message || "Could not post landlord credit."}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
