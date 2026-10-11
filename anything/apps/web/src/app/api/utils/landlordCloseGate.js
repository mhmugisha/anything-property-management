// Balances within half a cent of zero count as settled: fees can leave
// fractions and payouts are recorded in whole cents.
export const SETTLED_EPSILON = 0.005;

function formatUGX(n) {
  return `${Math.round(Math.abs(Number(n) || 0)).toLocaleString("en-US")} UGX`;
}

export function isSettled(netDue) {
  return Math.abs(Number(netDue) || 0) < SETTLED_EPSILON;
}

export function landlordOwedMessage(netDue) {
  return `Landlord is still owed ${formatUGX(netDue)}. Settle the balance to close.`;
}

/**
 * What still stops a landlord from closing. Shared by Close Landlord (which
 * refuses with the first blocker) and the exit summary (which lists them), so
 * the two can't disagree.
 *
 * A positive net due is not a blocker: the close payout settles it. A negative
 * one (the landlord owes the agency) is, until collection/write-off exists.
 *
 * @returns {{ can_close: boolean, close_blockers: string[],
 *   close_blocker_codes: string[] }}
 */
export function evaluateLandlordCloseGate({
  activeLeasesCount,
  livePropertiesCount,
  netDue,
}) {
  const codes = [];
  const messages = [];

  const leases = Number(activeLeasesCount) || 0;
  if (leases > 0) {
    codes.push("active_leases");
    messages.push(
      `This landlord still has ${leases} active tenant lease(s). End all tenant leases before closing this landlord.`,
    );
  }

  const live = Number(livePropertiesCount) || 0;
  if (live > 0) {
    codes.push("live_properties");
    messages.push(
      live === 1
        ? "Decommission the remaining property before closing this landlord."
        : `Decommission all ${live} properties before closing this landlord.`,
    );
  }

  const net = Number(netDue) || 0;
  if (net < 0 && !isSettled(net)) {
    codes.push("negative_balance");
    messages.push(
      `Landlord owes Exela ${formatUGX(net)} — collection/write-off is not yet available (gate 3).`,
    );
  }

  return {
    can_close: codes.length === 0,
    close_blockers: messages,
    close_blocker_codes: codes,
  };
}
