"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  LayoutGrid,
  Table as TableIcon,
  Building,
  Archive,
} from "lucide-react";
import { formatCurrencyUGX } from "@/utils/formatCurrency";

const MONTH_NAMES = [
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

const UNASSIGNED = "__unassigned__";

function pct(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 100);
}

function occupancyTone(value) {
  if (value === null) return null;
  if (value === 0) return "red";
  if (value >= 85) return "green";
  return "amber";
}

function recoveryTone(value) {
  if (value === null) return null;
  if (value >= 90) return "green";
  if (value >= 75) return "amber";
  return "red";
}

const TONE_BAR = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
};

const TONE_TEXT = {
  green: "text-green-700",
  amber: "text-amber-700",
  red: "text-rose-700",
};

function Meter({ value, tone, label }) {
  const width = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : width}
      >
        {value !== null && (
          <div
            className={`h-full rounded-full ${TONE_BAR[tone]}`}
            style={{ width: `${width}%` }}
          />
        )}
      </div>
      <span
        className={`w-10 text-right text-xs font-semibold tabular-nums ${
          value === null ? "text-slate-400" : TONE_TEXT[tone]
        }`}
      >
        {value === null ? "—" : `${value}%`}
      </span>
    </div>
  );
}

function rowMetrics(p) {
  const totalUnits = Number(p.total_units || 0);
  const occupied = Number(p.occupied_units || 0);
  const occupancy = pct(occupied, totalUnits);
  const recovery =
    p.recovery_pct === null || p.recovery_pct === undefined
      ? null
      : Number(p.recovery_pct);
  return { totalUnits, occupied, occupancy, recovery };
}

function OccupancyMeter({ property }) {
  const { occupancy } = rowMetrics(property);
  return (
    <Meter
      value={occupancy}
      tone={occupancyTone(occupancy)}
      label="Occupancy"
    />
  );
}

function RecoveryMeter({ property }) {
  const { recovery } = rowMetrics(property);
  return (
    <Meter
      value={recovery}
      tone={recoveryTone(recovery)}
      label="Rent recovered"
    />
  );
}

function StatusChip({ archived }) {
  return archived ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-slate-600 border border-gray-200">
      <Archive className="w-3 h-3" />
      Archived
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
      Active
    </span>
  );
}

function ManagerName({ name }) {
  return name ? (
    <span className="text-slate-700">{name}</span>
  ) : (
    <span className="text-slate-400 italic">Unassigned</span>
  );
}

function SummaryTile({ title, value, hint }) {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {title}
      </div>
      <div className="mt-2 text-lg sm:text-xl xl:text-2xl font-semibold text-[#0B1F3A] tabular-nums">
        {value}
      </div>
      {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function PropertyCard({ property, onOpen }) {
  const { totalUnits } = rowMetrics(property);
  const archived = property.is_archived === true;
  return (
    <button
      type="button"
      onClick={() => onOpen(property.id)}
      className={`text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-[#0B1F3A]/30 hover:shadow transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
        archived ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-800 truncate">
            {property.property_name}
          </div>
          {property.landlord_name && (
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {property.landlord_name}
            </div>
          )}
        </div>
        <StatusChip archived={archived} />
      </div>

      <div className="mt-3 text-xs text-slate-500">
        {totalUnits} {totalUnits === 1 ? "unit" : "units"}
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <div className="text-xs text-slate-500 mb-1">Occupancy</div>
          <OccupancyMeter property={property} />
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Rent recovered</div>
          <RecoveryMeter property={property} />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-end justify-between gap-2 text-sm">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">Rent roll / mo</div>
          <div className="font-semibold text-slate-800 tabular-nums">
            UGX {formatCurrencyUGX(property.rent_roll)}
          </div>
        </div>
        <div className="min-w-0 text-right truncate">
          <ManagerName name={property.manager_name} />
        </div>
      </div>
    </button>
  );
}

function PropertiesTable({ properties, onOpen }) {
  const onKey = (e, id) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(id);
    }
  };

  return (
    <>
      {/* Desktop table */}
      <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-gray-100">
              <th className="py-3 px-4 font-medium">Property</th>
              <th className="py-3 px-4 font-medium">Landlord</th>
              <th className="py-3 px-4 font-medium text-right">Units</th>
              <th className="py-3 px-4 font-medium w-44">Occupancy</th>
              <th className="py-3 px-4 font-medium w-44">Rent recovered</th>
              <th className="py-3 px-4 font-medium text-right">
                Rent roll (UGX)
              </th>
              <th className="py-3 px-4 font-medium">Manager</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr
                key={p.id}
                tabIndex={0}
                onClick={() => onOpen(p.id)}
                onKeyDown={(e) => onKey(e, p.id)}
                className={`border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 focus:outline-none focus:bg-gray-50 ${
                  p.is_archived ? "opacity-60" : ""
                }`}
              >
                <td className="py-3 px-4 font-medium text-slate-800">
                  {p.property_name}
                </td>
                <td className="py-3 px-4 text-slate-600">
                  {p.landlord_name || ""}
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                  {Number(p.total_units || 0)}
                </td>
                <td className="py-3 px-4">
                  <OccupancyMeter property={p} />
                </td>
                <td className="py-3 px-4">
                  <RecoveryMeter property={p} />
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-slate-800 whitespace-nowrap">
                  {formatCurrencyUGX(p.rent_roll)}
                </td>
                <td className="py-3 px-4">
                  <ManagerName name={p.manager_name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone / tablet: each row folds into a labeled card */}
      <div className="lg:hidden space-y-3">
        {properties.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen(p.id)}
            className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-300 ${
              p.is_archived ? "opacity-60" : ""
            }`}
          >
            <div className="font-semibold text-slate-800">
              {p.property_name}
            </div>
            <dl className="mt-2 grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2 text-sm items-center">
              <dt className="text-xs text-slate-500">Landlord</dt>
              <dd className="text-slate-700 min-w-0 truncate">
                {p.landlord_name || "—"}
              </dd>
              <dt className="text-xs text-slate-500">Units</dt>
              <dd className="text-slate-700 tabular-nums">
                {Number(p.total_units || 0)}
              </dd>
              <dt className="text-xs text-slate-500">Occupancy</dt>
              <dd className="min-w-0">
                <OccupancyMeter property={p} />
              </dd>
              <dt className="text-xs text-slate-500">Rent recovered</dt>
              <dd className="min-w-0">
                <RecoveryMeter property={p} />
              </dd>
              <dt className="text-xs text-slate-500">Rent roll</dt>
              <dd className="text-slate-800 tabular-nums">
                UGX {formatCurrencyUGX(p.rent_roll)}
              </dd>
              <dt className="text-xs text-slate-500">Manager</dt>
              <dd className="min-w-0 truncate">
                <ManagerName name={p.manager_name} />
              </dd>
            </dl>
          </button>
        ))}
      </div>
    </>
  );
}

export function PropertiesOverview({
  properties = [],
  isLoading = false,
  error = null,
  recoveryMonth = null,
  recoveryYear = null,
  showArchived = false,
  onShowArchivedChange,
  view = "cards",
  onViewChange,
  onOpenProperty,
  onCreateProperty,
}) {
  const [search, setSearch] = useState("");
  const [landlordFilter, setLandlordFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");

  const landlordOptions = useMemo(() => {
    const map = new Map();
    for (const p of properties) {
      if (p.landlord_id && p.landlord_name) {
        map.set(String(p.landlord_id), p.landlord_name);
      }
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [properties]);

  const managerOptions = useMemo(() => {
    const map = new Map();
    let hasUnassigned = false;
    for (const p of properties) {
      if (p.assigned_officer_id && p.manager_name) {
        map.set(String(p.assigned_officer_id), p.manager_name);
      } else {
        hasUnassigned = true;
      }
    }
    const opts = [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (hasUnassigned) opts.push({ value: UNASSIGNED, label: "Unassigned" });
    return opts;
  }, [properties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (
        q &&
        !(p.property_name || "").toLowerCase().includes(q) &&
        !(p.address || "").toLowerCase().includes(q)
      ) {
        return false;
      }
      if (landlordFilter && String(p.landlord_id) !== landlordFilter) {
        return false;
      }
      if (managerFilter) {
        const assigned = p.assigned_officer_id && p.manager_name;
        if (managerFilter === UNASSIGNED) {
          if (assigned) return false;
        } else if (String(p.assigned_officer_id) !== managerFilter) {
          return false;
        }
      }
      return true;
    });
  }, [properties, search, landlordFilter, managerFilter]);

  // Tiles summarise the active properties currently in view (filters apply;
  // archived properties never count).
  const summary = useMemo(() => {
    const active = filtered.filter((p) => p.is_archived !== true);
    let units = 0;
    let occupied = 0;
    let billed = 0;
    let collected = 0;
    let rentRoll = 0;
    for (const p of active) {
      units += Number(p.total_units || 0);
      occupied += Number(p.occupied_units || 0);
      billed += Number(p.recovery_billed || 0);
      collected += Number(p.recovery_collected || 0);
      rentRoll += Number(p.rent_roll || 0);
    }
    return {
      count: active.length,
      units,
      occupied,
      occupancy: pct(occupied, units),
      recovery: pct(collected, billed),
      rentRoll,
    };
  }, [filtered]);

  const periodLabel =
    recoveryMonth && recoveryYear
      ? `${MONTH_NAMES[recoveryMonth - 1]} ${recoveryYear}`
      : null;

  const filtersActive =
    search.trim() !== "" || landlordFilter !== "" || managerFilter !== "";

  const viewButton = (value, Icon, label) => (
    <button
      type="button"
      onClick={() => onViewChange?.(value)}
      aria-pressed={view === value}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        view === value
          ? "bg-[#0B1F3A] text-white"
          : "text-slate-600 hover:bg-gray-100"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryTile
          title="Properties"
          value={summary.count}
          hint={filtersActive ? "Active, matching filters" : "Active"}
        />
        <SummaryTile
          title="Occupancy"
          value={summary.occupancy === null ? "—" : `${summary.occupancy}%`}
          hint={`${summary.occupied} of ${summary.units} units`}
        />
        <SummaryTile
          title="Rent recovered"
          value={summary.recovery === null ? "—" : `${summary.recovery}%`}
          hint={periodLabel || "This month"}
        />
        <SummaryTile
          title="Monthly rent roll"
          value={formatCurrencyUGX(summary.rentRoll)}
          hint="UGX, active leases"
        />
      </div>

      <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or address..."
            aria-label="Search properties"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
          />
        </div>
        <select
          value={landlordFilter}
          onChange={(e) => setLandlordFilter(e.target.value)}
          aria-label="Filter by landlord"
          className="w-full sm:w-auto sm:max-w-[14rem] px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
        >
          <option value="">All landlords</option>
          {landlordOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={managerFilter}
          onChange={(e) => setManagerFilter(e.target.value)}
          aria-label="Filter by manager"
          className="w-full sm:w-auto sm:max-w-[14rem] px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
        >
          <option value="">All managers</option>
          {managerOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 px-2 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => onShowArchivedChange?.(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show archived
        </label>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <div
            className="inline-flex p-0.5 rounded-lg border border-gray-200 bg-white"
            role="group"
            aria-label="View"
          >
            {viewButton("cards", LayoutGrid, "Cards")}
            {viewButton("table", TableIcon, "Table")}
          </div>
          <button
            type="button"
            onClick={onCreateProperty}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add property
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          {filtered.length} {filtered.length === 1 ? "property" : "properties"}
        </span>
        {periodLabel && <span>Recovery: {periodLabel}</span>}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center text-slate-500">
          Loading properties...
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center text-red-600">
          {error.message || "Failed to load properties"}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-dashed border-gray-200 text-center text-slate-500">
          <Building className="w-6 h-6 mx-auto mb-2 text-slate-400" />
          {properties.length === 0
            ? "No properties yet. Add one to get started."
            : "No properties match these filters."}
        </div>
      ) : view === "table" ? (
        <PropertiesTable properties={filtered} onOpen={onOpenProperty} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PropertyCard key={p.id} property={p} onOpen={onOpenProperty} />
          ))}
        </div>
      )}
    </div>
  );
}
