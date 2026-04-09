export function TabButton({ active, label, onClick }) {
  const base = "px-3 py-2 rounded-lg text-sm font-medium";
  const classes = active
    ? `${base} bg-slate-900 text-white`
    : `${base} bg-white border border-gray-200 text-slate-700 hover:bg-gray-50`;

  return (
    <button type="button" className={classes} onClick={onClick}>
      {label}
    </button>
  );
}
