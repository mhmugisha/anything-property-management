export function safeIdentifier(name) {
  const n = String(name || "").trim();
  if (!n) {
    throw new Error("safeIdentifier: empty identifier");
  }
  // Very strict: only allow unquoted, lower_snake identifiers.
  if (!/^[a-z_][a-z0-9_]*$/.test(n)) {
    throw new Error(`safeIdentifier: invalid identifier [${n}]`);
  }
  return n;
}
