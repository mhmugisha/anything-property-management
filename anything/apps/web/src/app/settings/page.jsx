"use client";

import { useState } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import SettingsSidebar from "@/components/Shell/SettingsSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { TabButton } from "@/components/Settings/TabButton";
import { AlertBanner } from "@/components/Settings/AlertBanner";
import { UsersTab } from "@/components/Settings/UsersTab";
import { RolesTab } from "@/components/Settings/RolesTab";
import { EditUserModal } from "@/components/Settings/EditUserModal";
import { EditRoleModal } from "@/components/Settings/EditRoleModal";
import { SetPasswordModal } from "@/components/Settings/SetPasswordModal";
import { useSettingsUsers } from "@/hooks/useSettingsUsers";
import { useSettingsRoles } from "@/hooks/useSettingsRoles";
import { TAB_USERS, TAB_ROLES } from "@/components/Settings/constants";

export default function SettingsPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tab, setTab] = useState(TAB_USERS);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const isAdmin = staffQuery.data?.role_name === "Admin";
  const enabled = !userLoading && !!user && !!staffQuery.data;

  const rolesHook = useSettingsRoles({ enabled });
  const usersHook = useSettingsUsers({ enabled, isAdmin });

  const handleCreateUser = () => {
    setActionError(null);
    setActionSuccess(null);

    const roleIdNum = usersHook.newUserRoleId
      ? Number(usersHook.newUserRoleId)
      : null;
    if (!roleIdNum || !Number.isFinite(roleIdNum)) {
      setActionError("Please select a role.");
      return;
    }

    usersHook.createUser(roleIdNum);
    usersHook.createUserMutation.isSuccess &&
      setActionSuccess("User added.") &&
      window.setTimeout(() => setActionSuccess(null), 2500);
  };

  const handleSaveEditUser = () => {
    setActionError(null);
    setActionSuccess(null);

    try {
      usersHook.onSaveEditUser();
      setActionSuccess("Saved.");
      window.setTimeout(() => setActionSuccess(null), 2000);
    } catch (err) {
      console.error(err);
      setActionError(err?.message || "Could not update user");
    }
  };

  const handleCreateRole = () => {
    setActionError(null);
    setActionSuccess(null);
    rolesHook.createRole();
    rolesHook.createRoleMutation.isSuccess &&
      setActionSuccess("Role created.") &&
      window.setTimeout(() => setActionSuccess(null), 2500);
  };

  const handleSaveEditRole = () => {
    setActionError(null);
    setActionSuccess(null);
    rolesHook.onSaveEditRole();
    rolesHook.updateRoleMutation.isSuccess &&
      setActionSuccess("Saved.") &&
      window.setTimeout(() => setActionSuccess(null), 2000);
  };

  const handleDeleteRole = (r) => {
    setActionError(null);
    setActionSuccess(null);
    rolesHook.onDeleteRole(r);
    rolesHook.deleteRoleMutation.isSuccess &&
      setActionSuccess("Role deleted.") &&
      window.setTimeout(() => setActionSuccess(null), 2500);
  };

  const handleOpenEditUser = (u) => {
    setActionError(null);
    setActionSuccess(null);
    usersHook.openEditUser(u);
  };

  const handleOpenEditRole = (r) => {
    setActionError(null);
    setActionSuccess(null);
    rolesHook.openEditRole(r);
  };

  const handleLoadRoleIntoEditor = (r) => {
    setActionError(null);
    setActionSuccess(null);
    rolesHook.loadRoleIntoEditor(r);
  };

  const handleSaveSetPassword = () => {
    setActionError(null);
    setActionSuccess(null);
    usersHook.onSaveSetPassword();
    usersHook.setPasswordMutation.isSuccess &&
      setActionSuccess("Password updated.") &&
      window.setTimeout(() => setActionSuccess(null), 2500);
  };

  const isLoading = userLoading || staffQuery.isLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/account/signin";
    return null;
  }

  if (!staffQuery.data) {
    if (typeof window !== "undefined") window.location.href = "/onboarding";
    return null;
  }

  if (!isAdmin) {
    return (
      <AccessDenied
        title="Settings"
        message="Only admins can manage users and roles."
      />
    );
  }

  const showUsers = tab === TAB_USERS;
  const showRoles = tab === TAB_ROLES;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Settings"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="settings"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="settings"
      />
      <Sidebar active="settings">
        <SettingsSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className="p-4 md:p-6 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">
                Settings
              </h1>
              <p className="text-slate-500">
                Manage staff users and permission roles.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <TabButton
                active={showUsers}
                label="Staff users"
                onClick={() => setTab(TAB_USERS)}
              />
              <TabButton
                active={showRoles}
                label="Roles"
                onClick={() => setTab(TAB_ROLES)}
              />
            </div>
          </div>

          <AlertBanner type="error" message={actionError} />
          <AlertBanner type="success" message={actionSuccess} />

          {showUsers ? (
            <UsersTab
              users={usersHook.users}
              usersLoading={usersHook.usersLoading}
              usersError={usersHook.usersError}
              newUserEmail={usersHook.newUserEmail}
              setNewUserEmail={usersHook.setNewUserEmail}
              newUserFullName={usersHook.newUserFullName}
              setNewUserFullName={usersHook.setNewUserFullName}
              newUserPhone={usersHook.newUserPhone}
              setNewUserPhone={usersHook.setNewUserPhone}
              newUserRoleId={usersHook.newUserRoleId}
              setNewUserRoleId={usersHook.setNewUserRoleId}
              newUserPassword={usersHook.newUserPassword}
              setNewUserPassword={usersHook.setNewUserPassword}
              roleOptions={rolesHook.roleOptions}
              canCreateUser={usersHook.canCreateUser}
              onCreateUser={handleCreateUser}
              createUserMutation={usersHook.createUserMutation}
              openEditUser={handleOpenEditUser}
              openSetPassword={usersHook.openSetPassword}
              onDeleteUser={usersHook.onDeleteUser}
              deleteUserMutation={usersHook.deleteUserMutation}
            />
          ) : null}

          {showRoles ? (
            <RolesTab
              roles={rolesHook.roles}
              roleOptions={rolesHook.roleOptions}
              rolesLoading={rolesHook.rolesLoading}
              rolesError={rolesHook.rolesError}
              newRoleName={rolesHook.newRoleName}
              setNewRoleName={rolesHook.setNewRoleName}
              newRolePermissions={rolesHook.newRolePermissions}
              setNewRolePermissions={rolesHook.setNewRolePermissions}
              createRoleDisabled={rolesHook.createRoleDisabled}
              onCreateRole={handleCreateRole}
              createRoleMutation={rolesHook.createRoleMutation}
              openEditRole={handleOpenEditRole}
              onDeleteRole={handleDeleteRole}
              deleteRoleMutation={rolesHook.deleteRoleMutation}
            />
          ) : null}
        </div>
      </main>

      <EditUserModal
        open={usersHook.editUserOpen}
        onClose={() => usersHook.setEditUserOpen(false)}
        editUserFullName={usersHook.editUserFullName}
        setEditUserFullName={usersHook.setEditUserFullName}
        editUserPhone={usersHook.editUserPhone}
        setEditUserPhone={usersHook.setEditUserPhone}
        editUserRoleId={usersHook.editUserRoleId}
        setEditUserRoleId={usersHook.setEditUserRoleId}
        editUserIsActive={usersHook.editUserIsActive}
        setEditUserIsActive={usersHook.setEditUserIsActive}
        editUserPassword={usersHook.editUserPassword}
        setEditUserPassword={usersHook.setEditUserPassword}
        editUserEmail={usersHook.editUserEmail}
        editUserRoleName={usersHook.editUserRoleName}
        roleOptions={rolesHook.roleOptions}
        onSave={handleSaveEditUser}
        updateUserMutation={usersHook.updateUserMutation}
      />

      <SetPasswordModal
        open={usersHook.setPasswordOpen}
        onClose={() => usersHook.setSetPasswordOpen(false)}
        userName={usersHook.setPasswordUserName}
        userEmail={usersHook.setPasswordUserEmail}
        password={usersHook.setPasswordValue}
        setPassword={usersHook.setSetPasswordValue}
        onSave={handleSaveSetPassword}
        saveMutation={usersHook.setPasswordMutation}
      />

      <EditRoleModal
        open={rolesHook.editRoleOpen}
        onClose={() => rolesHook.setEditRoleOpen(false)}
        editRoleId={rolesHook.editRoleId}
        setEditRoleId={rolesHook.setEditRoleId}
        editRoleName={rolesHook.editRoleName}
        setEditRoleName={rolesHook.setEditRoleName}
        editRolePermissions={rolesHook.editRolePermissions}
        setEditRolePermissions={rolesHook.setEditRolePermissions}
        roleOptions={rolesHook.roleOptions}
        loadRoleIntoEditor={handleLoadRoleIntoEditor}
        onSave={handleSaveEditRole}
        updateRoleMutation={rolesHook.updateRoleMutation}
      />
    </div>
  );
}
