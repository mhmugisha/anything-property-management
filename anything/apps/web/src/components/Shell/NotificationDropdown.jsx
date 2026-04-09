"use client";

import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllRead,
} from "@/hooks/useNotifications";

export default function NotificationDropdown({ onClose }) {
  const [expandedId, setExpandedId] = useState(null);

  // Fetch 20 notifications (both read and unread)
  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useNotifications({
    page: 1,
    limit: 20,
    unreadOnly: false,
  });
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllRead();

  const allNotifications = data?.notifications || [];
  const error = queryError ? "Failed to load notifications" : null;

  // Sort notifications: unread first, then read, all by created_at desc within each group
  const sortedNotifications = [...allNotifications].sort((a, b) => {
    if (a.is_read === b.is_read) {
      // Same read status - sort by date descending
      return new Date(b.created_at) - new Date(a.created_at);
    }
    // Unread (false) before read (true)
    return a.is_read ? 1 : -1;
  });

  const notifications = sortedNotifications;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Mark single notification as read and toggle expansion
  const handleNotificationClick = async (notificationId) => {
    // Toggle expansion
    setExpandedId(expandedId === notificationId ? null : notificationId);

    // Mark as read
    const notification = notifications.find((n) => n.id === notificationId);
    if (notification && !notification.is_read) {
      try {
        await markAsReadMutation.mutateAsync(notificationId);
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  // Format time ago
  const getTimeAgo = (createdAt) => {
    try {
      return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
    } catch {
      return "recently";
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Notifications {unreadCount > 0 && `(${unreadCount})`}
        </h3>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={markAllAsReadMutation.isPending}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {markAllAsReadMutation.isPending
              ? "Marking..."
              : "Mark all as read"}
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-red-600">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No notifications
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => {
              const isExpanded = expandedId === notification.id;
              const isRead = notification.is_read;

              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification.id)}
                  disabled={markAsReadMutation.isPending}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed ${
                    isRead ? "bg-white opacity-50 blur-[0.5px]" : "bg-blue-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!isRead && (
                      <div className="flex-shrink-0 w-2 h-2 rounded-full mt-2 bg-blue-600"></div>
                    )}
                    <div className={`flex-1 min-w-0 ${isRead ? "ml-5" : ""}`}>
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {notification.title}
                      </p>
                      <p
                        className={`text-sm text-gray-600 mt-1 ${isExpanded ? "" : "line-clamp-2"}`}
                      >
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">
                          {getTimeAgo(notification.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-gray-200 px-4 py-2">
          <button
            onClick={onClose}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-1"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
