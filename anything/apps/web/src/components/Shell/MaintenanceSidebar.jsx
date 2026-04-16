"use client";

import { useState, useEffect } from "react";
import { Wrench, AlertCircle } from "lucide-react";

export default function MaintenanceSidebar() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/maintenance");
        if (!response.ok) {
          throw new Error("Failed to load maintenance requests");
        }
        const data = await response.json();
        setRequests(data.requests || []);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Could not load maintenance requests");
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "text-amber-400";
      case "in_progress":
        return "text-sky-400";
      case "completed":
        return "text-green-400";
      default:
        return "text-slate-400";
    }
  };

  const getPriorityIcon = (priority) => {
    if (priority === "high" || priority === "urgent") {
      return <AlertCircle className="w-3 h-3 text-rose-400" />;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
          Maintenance Menu
        </div>
      </div>

      {/* Requests list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {error ? (
          <div className="px-4 py-4 text-rose-300 text-sm">{error}</div>
        ) : loading ? (
          <div className="px-4 py-4 text-slate-400 text-sm">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="px-4 py-4 text-slate-400 text-sm">
            No maintenance requests
          </div>
        ) : (
          <div className="py-2">
            {requests.map((request) => {
              const statusColor = getStatusColor(request.status);
              const priorityIcon = getPriorityIcon(request.priority);

              return (
                <div
                  key={request.id}
                  className="px-4 py-2.5 mb-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <Wrench className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="text-sm font-medium text-white truncate flex-1">
                          {request.title}
                        </div>
                        {priorityIcon}
                      </div>
                      {request.property_name && (
                        <div className="text-xs text-slate-400 mt-0.5 truncate">
                          {request.property_name}
                          {request.unit_number &&
                            ` - Unit ${request.unit_number}`}
                        </div>
                      )}
                      <div
                        className={`text-xs font-medium mt-1 ${statusColor}`}
                      >
                        {request.status?.replace("_", " ")}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
