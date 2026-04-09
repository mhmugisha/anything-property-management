export function AlertBanner({ type, message }) {
  if (!message) return null;

  const isError = type === "error";
  const bgColor = isError ? "bg-rose-50" : "bg-emerald-50";
  const borderColor = isError ? "border-rose-200" : "border-emerald-200";
  const textColor = isError ? "text-rose-700" : "text-emerald-700";

  return (
    <div
      className={`rounded-xl ${bgColor} border ${borderColor} p-3 text-sm ${textColor}`}
    >
      {message}
    </div>
  );
}
