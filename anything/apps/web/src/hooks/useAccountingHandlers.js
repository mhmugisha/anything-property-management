import { useCallback } from "react";

export function useAccountingHandlers({
  accountCode,
  accountName,
  accountType,
  setAccountCode,
  setAccountName,
  setAccountType,
  createAccountMutation,
  txDate,
  txDescription,
  txRef,
  txDebit,
  txCredit,
  txAmount,
  setTxDescription,
  setTxRef,
  setTxDebit,
  setTxCredit,
  setTxAmount,
  createJournalMutation,
  ldLandlordId,
  ldPropertyId,
  ldDate,
  ldDescription,
  ldAmount,
  ldSource,
  setLdDescription,
  setLdAmount,
  createLandlordDeductionMutation,
  tdLandlordId,
  tdTenantId,
  tdPropertyId,
  tdDate,
  tdDescription,
  tdAmount,
  tdSource,
  setTdDescription,
  setTdAmount,
  createTenantDeductionMutation,
}) {
  const onCreateAccount = useCallback(() => {
    const payload = {
      account_code: accountCode,
      account_name: accountName,
      account_type: accountType,
      is_active: true,
    };

    createAccountMutation.mutate(payload, {
      onSuccess: () => {
        setAccountCode("");
        setAccountName("");
        setAccountType("Asset");
      },
    });
  }, [
    accountCode,
    accountName,
    accountType,
    createAccountMutation,
    setAccountCode,
    setAccountName,
    setAccountType,
  ]);

  const onCreateJournal = useCallback(() => {
    const payload = {
      transaction_date: txDate,
      description: txDescription,
      reference_number: txRef || null,
      debit_account_id: Number(txDebit),
      credit_account_id: Number(txCredit),
      amount: Number(txAmount),
      currency: "UGX",
    };

    createJournalMutation.mutate(payload, {
      onSuccess: () => {
        setTxDescription("");
        setTxRef("");
        setTxDebit("");
        setTxCredit("");
        setTxAmount("");
      },
    });
  }, [
    txDate,
    txDescription,
    txRef,
    txDebit,
    txCredit,
    txAmount,
    createJournalMutation,
    setTxDescription,
    setTxRef,
    setTxDebit,
    setTxCredit,
    setTxAmount,
  ]);

  const onCreateLandlordDeduction = useCallback(() => {
    const payload = {
      landlord_id: Number(ldLandlordId),
      property_id: ldPropertyId ? Number(ldPropertyId) : null,
      deduction_date: ldDate,
      description: ldDescription,
      amount: Number(ldAmount),
      payment_source: ldSource,
    };

    createLandlordDeductionMutation.mutate(payload, {
      onSuccess: () => {
        setLdDescription("");
        setLdAmount("");
      },
    });
  }, [
    ldLandlordId,
    ldPropertyId,
    ldDate,
    ldDescription,
    ldAmount,
    ldSource,
    createLandlordDeductionMutation,
    setLdDescription,
    setLdAmount,
  ]);

  const onCreateTenantDeduction = useCallback(() => {
    const payload = {
      landlord_id: tdLandlordId ? Number(tdLandlordId) : null,
      tenant_id: Number(tdTenantId),
      property_id: tdPropertyId ? Number(tdPropertyId) : null,
      deduction_date: tdDate,
      description: tdDescription,
      amount: Number(tdAmount),
      payment_source: tdSource,
    };

    createTenantDeductionMutation.mutate(payload, {
      onSuccess: () => {
        setTdDescription("");
        setTdAmount("");
      },
    });
  }, [
    tdLandlordId,
    tdTenantId,
    tdPropertyId,
    tdDate,
    tdDescription,
    tdAmount,
    tdSource,
    createTenantDeductionMutation,
    setTdDescription,
    setTdAmount,
  ]);

  return {
    onCreateAccount,
    onCreateJournal,
    onCreateLandlordDeduction,
    onCreateTenantDeduction,
  };
}
