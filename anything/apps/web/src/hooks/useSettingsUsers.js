import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, putJson, deleteJson } from "@/utils/api";

export function useSettingsUsers({ enabled, isAdmin }) {
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["staff", "users"],
    queryFn: async () => {
      const data = await fetchJson("/api/staff/users");
      return data.users || [];
    },
    enabled: enabled && isAdmin,
  });

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserRoleId, setNewUserRoleId] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [editUserFullName, setEditUserFullName] = useState("");
  const [editUserPhone, setEditUserPhone] = useState("");
  const [editUserRoleId, setEditUserRoleId] = useState("");
  const [editUserIsActive, setEditUserIsActive] = useState(true);
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRoleName, setEditUserRoleName] = useState("");

  const [setPasswordOpen, setSetPasswordOpen] = useState(false);
  const [setPasswordUserId, setSetPasswordUserId] = useState(null);
  const [setPasswordUserName, setSetPasswordUserName] = useState("");
  const [setPasswordUserEmail, setSetPasswordUserEmail] = useState("");
  const [setPasswordValue, setSetPasswordValue] = useState("");

  const createUserMutation = useMutation({
    mutationFn: async (payload) => {
      return postJson("/api/staff/users", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "users"] });
      setNewUserEmail("");
      setNewUserFullName("");
      setNewUserPhone("");
      setNewUserRoleId("");
      setNewUserPassword("");
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      return putJson(`/api/staff/users/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "users"] });
      setEditUserOpen(false);
      setEditUserPassword("");
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: async ({ id, password }) => {
      return putJson(`/api/staff/users/${id}`, { password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "users"] });
      setSetPasswordOpen(false);
      setSetPasswordValue("");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id) => {
      return deleteJson(`/api/staff/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "users"] });
    },
  });

  const canCreateUser = useMemo(() => {
    return (
      newUserEmail.trim() !== "" &&
      newUserRoleId !== "" &&
      newUserPassword.trim().length >= 6 &&
      createUserMutation.isPending === false
    );
  }, [
    newUserEmail,
    newUserRoleId,
    newUserPassword,
    createUserMutation.isPending,
  ]);

  const openEditUser = useCallback((u) => {
    setEditUserId(u.id);
    setEditUserFullName(u.full_name || "");
    setEditUserPhone(u.phone || "");
    setEditUserRoleId(u.role_id ? String(u.role_id) : "");
    setEditUserIsActive(u.is_active !== false);
    setEditUserPassword("");
    setEditUserEmail(u.email || "");
    setEditUserRoleName(u.role_name || "");
    setEditUserOpen(true);
  }, []);

  const onSaveEditUser = useCallback(() => {
    if (!editUserId) return;

    const roleIdNum = editUserRoleId ? Number(editUserRoleId) : null;
    if (!roleIdNum || !Number.isFinite(roleIdNum)) {
      throw new Error("Please select a role.");
    }

    if (editUserPassword && editUserPassword.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    const payload = {
      full_name: editUserFullName,
      phone: editUserPhone,
      role_id: roleIdNum,
      is_active: editUserIsActive,
    };

    // Only include password if the admin typed one
    if (editUserPassword) {
      payload.password = editUserPassword;
    }

    updateUserMutation.mutate({ id: editUserId, payload });
  }, [
    editUserId,
    editUserRoleId,
    editUserFullName,
    editUserPhone,
    editUserIsActive,
    editUserPassword,
    updateUserMutation,
  ]);

  const createUser = useCallback(
    (roleIdNum) => {
      createUserMutation.mutate({
        email: newUserEmail,
        full_name: newUserFullName,
        phone: newUserPhone,
        role_id: roleIdNum,
        password: newUserPassword,
      });
    },
    [
      newUserEmail,
      newUserFullName,
      newUserPhone,
      newUserPassword,
      createUserMutation,
    ],
  );

  const openSetPassword = useCallback((u) => {
    setSetPasswordUserId(u.id);
    setSetPasswordUserName(u.full_name || "");
    setSetPasswordUserEmail(u.email || "");
    setSetPasswordValue("");
    setSetPasswordOpen(true);
  }, []);

  const onSaveSetPassword = useCallback(() => {
    if (!setPasswordUserId) return;
    if (setPasswordValue.trim().length < 6) return;

    setPasswordMutation.mutate({
      id: setPasswordUserId,
      password: setPasswordValue,
    });
  }, [setPasswordUserId, setPasswordValue, setPasswordMutation]);

  const onDeleteUser = useCallback(
    (userId) => {
      const confirmed = window.confirm(
        "Are you sure you want to delete this user? This action cannot be undone.",
      );
      if (confirmed) {
        deleteUserMutation.mutate(userId);
      }
    },
    [deleteUserMutation],
  );

  return {
    users: usersQuery.data || [],
    usersLoading: usersQuery.isLoading,
    usersError: usersQuery.error ? "Could not load staff users." : null,
    newUserEmail,
    setNewUserEmail,
    newUserFullName,
    setNewUserFullName,
    newUserPhone,
    setNewUserPhone,
    newUserRoleId,
    setNewUserRoleId,
    newUserPassword,
    setNewUserPassword,
    canCreateUser,
    createUser,
    createUserMutation,
    editUserOpen,
    setEditUserOpen,
    editUserId,
    editUserFullName,
    setEditUserFullName,
    editUserPhone,
    setEditUserPhone,
    editUserRoleId,
    setEditUserRoleId,
    editUserIsActive,
    setEditUserIsActive,
    editUserPassword,
    setEditUserPassword,
    editUserEmail,
    editUserRoleName,
    openEditUser,
    onSaveEditUser,
    updateUserMutation,
    setPasswordOpen,
    setSetPasswordOpen,
    setPasswordUserId,
    setPasswordUserName,
    setPasswordUserEmail,
    setPasswordValue,
    setSetPasswordValue,
    openSetPassword,
    onSaveSetPassword,
    setPasswordMutation,
    onDeleteUser,
    deleteUserMutation,
  };
}
