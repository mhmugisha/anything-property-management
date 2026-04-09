import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Query keys for caching
const QUERY_KEYS = {
  notifications: (params) => ["notifications", params],
  unreadCount: ["notifications", "unread-count"],
};

/**
 * Hook to fetch notifications with pagination and filtering
 * @param {Object} options
 * @param {number} options.page - Page number (1-based)
 * @param {number} options.limit - Items per page
 * @param {boolean} options.unreadOnly - Filter to unread only
 * @param {boolean} options.enabled - Enable/disable the query
 */
export function useNotifications({
  page = 1,
  limit = 20,
  unreadOnly = false,
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.notifications({ page, limit, unreadOnly }),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(unreadOnly && { unreadOnly: "true" }),
      });

      const response = await fetch(`/api/notifications?${params}`);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch notifications: ${response.statusText}`,
        );
      }

      const data = await response.json();
      return data;
    },
    enabled,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    retry: 2,
  });
}

/**
 * Hook to fetch unread notification count
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: QUERY_KEYS.unreadCount,
    queryFn: async () => {
      const response = await fetch("/api/notifications/unread-count");
      if (!response.ok) {
        throw new Error(`Failed to fetch unread count: ${response.statusText}`);
      }

      const data = await response.json();
      return data.count || 0; // Fixed: API returns 'count', not 'unreadCount'
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    retry: 2,
  });
}

/**
 * Hook to mark a single notification as read
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: true }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to mark notification as read: ${response.statusText}`,
        );
      }

      return response.json();
    },
    onMutate: async (notificationId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["notifications"] });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueriesData({
        queryKey: ["notifications"],
      });

      // Optimistically update all notification queries
      queryClient.setQueriesData({ queryKey: ["notifications"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications?.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n,
          ),
        };
      });

      // Optimistically update unread count
      queryClient.setQueryData(QUERY_KEYS.unreadCount, (old) => {
        return Math.max(0, (old || 0) - 1);
      });

      return { previousNotifications };
    },
    onError: (err, notificationId, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        context.previousNotifications.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      console.error("Error marking notification as read:", err);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
    },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to mark all as read: ${response.statusText}`);
      }

      return response.json();
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["notifications"] });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueriesData({
        queryKey: ["notifications"],
      });
      const previousUnreadCount = queryClient.getQueryData(
        QUERY_KEYS.unreadCount,
      );

      // Optimistically update all notification queries
      queryClient.setQueriesData({ queryKey: ["notifications"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications?.map((n) => ({
            ...n,
            is_read: true,
          })),
        };
      });

      // Optimistically update unread count to 0
      queryClient.setQueryData(QUERY_KEYS.unreadCount, 0);

      return { previousNotifications, previousUnreadCount };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        context.previousNotifications.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousUnreadCount !== undefined) {
        queryClient.setQueryData(
          QUERY_KEYS.unreadCount,
          context.previousUnreadCount,
        );
      }
      console.error("Error marking all as read:", err);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
    },
  });
}

// Export query keys for external use if needed
export const notificationQueryKeys = QUERY_KEYS;
