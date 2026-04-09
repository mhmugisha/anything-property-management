import { useCallback, useEffect, useRef, useState } from "react";
import { useMemo } from "react";

function safeParseDateString(value) {
  if (!value || typeof value !== "string") return null;

  // Accept ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    try {
      const d = new Date(value + "T00:00:00");
      if (Number.isNaN(d.getTime())) return null;
      return d;
    } catch {
      return null;
    }
  }

  // Accept display format (DD-MM-YYYY)
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("-");
    const y = Number(yyyy);
    const m = Number(mm);
    const day = Number(dd);
    if (
      !Number.isInteger(y) ||
      !Number.isInteger(m) ||
      !Number.isInteger(day)
    ) {
      return null;
    }
    if (m < 1 || m > 12) return null;
    if (day < 1 || day > 31) return null;

    try {
      const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const d = new Date(iso + "T00:00:00");
      if (Number.isNaN(d.getTime())) return null;
      return d;
    } catch {
      return null;
    }
  }

  return null;
}

function formatYYYYMMDD(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDDMMYYYY(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}-${month}-${year}`;
}

function getMonthLabel(d) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeek(d) {
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function endOfWeek(d) {
  const day = d.getDay();
  const diff = d.getDate() + (6 - day);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addDays(d, n) {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function addMonths(d, n) {
  const result = new Date(d);
  result.setMonth(result.getMonth() + n);
  return result;
}

function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isSameMonth(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()
  );
}

export default function DatePopoverInput({
  value,
  onChange,
  placeholder = "DD-MM-YYYY",
  disabled = false,
  className = "",
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  // IMPORTANT: safeParseDateString() returns a NEW Date object each render.
  // If we don't memoize it, effects that depend on selectedDate will fire on
  // every render and can cause infinite update loops.
  const selectedDate = useMemo(() => safeParseDateString(value), [value]);

  const [viewMonth, setViewMonth] = useState(() => {
    const d = selectedDate || new Date();
    return startOfMonth(d);
  });

  useEffect(() => {
    if (selectedDate) {
      const next = startOfMonth(selectedDate);
      setViewMonth((prev) => {
        const sameMonth =
          prev.getFullYear() === next.getFullYear() &&
          prev.getMonth() === next.getMonth();
        return sameMonth ? prev : next;
      });
    }
  }, [selectedDate]);

  const displayText = selectedDate ? formatDDMMYYYY(selectedDate) : "";
  const monthLabel = getMonthLabel(viewMonth);

  const days = (() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));

    const out = [];
    let cur = start;
    for (let i = 0; i < 42; i += 1) {
      out.push(cur);
      if (cur >= end) break;
      cur = addDays(cur, 1);
    }
    return out;
  })();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target)) {
        close();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        close();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  const onPickDate = useCallback(
    (d) => {
      const iso = formatYYYYMMDD(d);
      onChange?.(iso);
      setOpen(false);
    },
    [onChange],
  );

  const toggleOpen = useCallback(() => {
    if (disabled) return;
    setOpen((p) => !p);
  }, [disabled]);

  const prev = useCallback(() => setViewMonth((m) => addMonths(m, -1)), []);
  const next = useCallback(() => setViewMonth((m) => addMonths(m, 1)), []);

  const inputClassName =
    `w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none ` +
    (disabled ? "opacity-60 cursor-not-allowed " : "cursor-pointer ") +
    className;

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        value={displayText}
        placeholder={placeholder}
        readOnly
        disabled={disabled}
        onClick={toggleOpen}
        className={inputClassName}
      />

      {open ? (
        <div className="absolute z-50 mt-2 w-[320px] max-w-[90vw] rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <button
              type="button"
              onClick={prev}
              className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-700"
            >
              ‹
            </button>
            <div className="text-sm font-semibold text-slate-800">
              {monthLabel}
            </div>
            <button
              type="button"
              onClick={next}
              className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-700"
            >
              ›
            </button>
          </div>

          <div className="px-3 py-3">
            <div className="grid grid-cols-7 gap-1 text-[11px] text-slate-500 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const inMonth = isSameMonth(d, viewMonth);
                const isSelected = selectedDate
                  ? isSameDay(d, selectedDate)
                  : false;

                const base =
                  "h-9 rounded-lg text-sm flex items-center justify-center";
                const monthStyle = inMonth
                  ? "text-slate-800 hover:bg-gray-50"
                  : "text-slate-400";
                const selectedStyle = isSelected
                  ? "bg-[#0B1F3A] text-white hover:bg-[#0B1F3A]"
                  : "";

                const buttonClass = `${base} ${monthStyle} ${selectedStyle}`;

                return (
                  <button
                    key={formatYYYYMMDD(d)}
                    type="button"
                    onClick={() => onPickDate(d)}
                    className={buttonClass}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={close}
                className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
