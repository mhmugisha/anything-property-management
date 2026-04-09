import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, putJson, deleteJson } from "@/utils/api";
import { PERMISSION_DEFS } from "@/components/Settings/constants";

export function useSettingsRoles({ enabled }) {
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: ["staff", "roles"],
    queryFn: async () => {
      const data = await fetchJson("/api/staff/roles");
      return data.roles || [];
    },
    enabled,
  });

  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePermissions, setNewRolePermissions] = useState(() => {
    const base = {};
    for (const def of PERMISSION_DEFS) base[def.key] = false;
    return base;
  });

  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRolePermissions, setEditRolePermissions] = useState({});

  const createRoleMutation = useMutation({
    mutationFn: async (payload) => {
      return postJson("/api/staff/roles", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "roles"] });
      setNewRoleName("");
      const base = {};
      for (const def of PERMISSION_DEFS) base[def.key] = false;
      setNewRolePermissions(base);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      return putJson(`/api/staff/roles/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "roles"] });
      queryClient.invalidateQueries({ queryKey: ["staff", "users"] });
      setEditRoleOpen(false);
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id) => {
      return deleteJson(`/api/staff/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "roles"] });
    },
  });

  const roleOptions = useMemo(() => {
    const list = [...(rolesQuery.data || [])];
    list.sort((a, b) => String(a.role_name).localeCompare(String(b.role_name)));
    return list;
  }, [rolesQuery.data]);

  const loadRoleIntoEditor = useCallback((r) => {
    if (!r) return;

    setEditRoleId(r.id);
    setEditRoleName(r.role_name || "");

    const incoming =
      r.permissions && typeof r.permissions === "object" ? r.permissions : {};
    const normalized = {};
    for (const def of PERMISSION_DEFS) {
      normalized[def.key] = incoming[def.key] === true;
    }
    setEditRolePermissions(normalized);
  }, []);

  const openEditRole = useCallback(
    (r) => {
      loadRoleIntoEditor(r);
      setEditRoleOpen(true);
    },
    [loadRoleIntoEditor],
  );

  const onSaveEditRole = useCallback(() => {
    if (!editRoleId) return;

    const payload = {
      role_name: editRoleName,
      permissions: editRolePermissions,
    };

    updateRoleMutation.mutate({ id: editRoleId, payload });
  }, [editRoleId, editRoleName, editRolePermissions, updateRoleMutation]);

  const onDeleteRole = useCallback(
    (r) => {
      if (!r?.id) return;
      const name = r.role_name || "";
      const ok = window.confirm(
        `Delete role "${name}"? This cannot be undone.`,
      );
      if (!ok) return;
      deleteRoleMutation.mutate(r.id);
    },
    [deleteRoleMutation],
  );

  const createRole = useCallback(() => {
    createRoleMutation.mutate({
      role_name: newRoleName,
      permissions: newRolePermissions,
    });
  }, [newRoleName, newRolePermissions, createRoleMutation]);

  const createRoleDisabled = useMemo(() => {
    return createRoleMutation.isPending || newRoleName.trim() === "";
  }, [createRoleMutation.isPending, newRoleName]);

  return {
    roles: rolesQuery.data || [],
    roleOptions,
    rolesLoading: rolesQuery.isLoading,
    rolesError: rolesQuery.error ? "Could not load roles." : null,
    newRoleName,
    setNewRoleName,
    newRolePermissions,
    setNewRolePermissions,
    createRole,
    createRoleDisabled,
    createRoleMutation,
    editRoleOpen,
    setEditRoleOpen,
    editRoleId,
    setEditRoleId,
    editRoleName,
    setEditRoleName,
    editRolePermissions,
    setEditRolePermissions,
    loadRoleIntoEditor,
    openEditRole,
    onSaveEditRole,
    updateRoleMutation,
    onDeleteRole,
    deleteRoleMutation,
  };
}
