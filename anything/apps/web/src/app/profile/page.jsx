"use client";

import { useState, useRef } from "react";
import {
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  Home,
  Camera,
  Loader2,
  Edit2,
  Check,
  X,
} from "lucide-react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import useUpload from "@/utils/useUpload";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";

export default function ProfilePage() {
  const { data: user, loading: userLoading } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const fileInputRef = useRef(null);

  // Phone editing state
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  const queriesEnabled = !userLoading && !!user;
  const staffProfileQuery = useStaffProfile(queriesEnabled);
  const [upload, { loading: uploading }] = useUpload();

  const staffProfile = staffProfileQuery.data || null;
  const loading =
    userLoading || (queriesEnabled && staffProfileQuery.isLoading);

  // Generate initials from name for fallback avatar
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-UG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("en-UG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear previous messages
    setUploadError(null);
    setUpdateError(null);
    setSuccessMessage(null);

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be less than 5MB");
      return;
    }

    try {
      // Step 1: Upload the file
      const { url, error: uploadErr } = await upload({ file });

      if (uploadErr) {
        setUploadError(uploadErr);
        return;
      }

      if (!url) {
        setUploadError("Upload failed - no URL returned");
        return;
      }

      // Step 2: Update profile picture in database
      const response = await fetch("/api/staff/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_picture: url }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update profile: ${errorText}`);
      }

      // Step 3: Refetch profile data to show new picture
      await staffProfileQuery.refetch();

      setSuccessMessage("Profile picture updated successfully!");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error updating profile picture:", error);
      setUpdateError(error.message || "Failed to update profile picture");
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePhoneEdit = () => {
    setPhoneValue(staffProfile.phone || "");
    setIsEditingPhone(true);
    setUpdateError(null);
    setSuccessMessage(null);
  };

  const handlePhoneSave = async () => {
    setSavingPhone(true);
    setUpdateError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/staff/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update phone: ${errorText}`);
      }

      await staffProfileQuery.refetch();
      setIsEditingPhone(false);
      setSuccessMessage("Phone number updated successfully!");

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error updating phone:", error);
      setUpdateError(error.message || "Failed to update phone number");
    } finally {
      setSavingPhone(false);
    }
  };

  const handlePhoneCancel = () => {
    setIsEditingPhone(false);
    setPhoneValue("");
    setUpdateError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/account/signin";
    }
    return null;
  }

  if (!staffProfile) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Profile"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active=""
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active=""
      />
      <Sidebar active="">
        {/* Empty sidebar for profile page */}
        <div className="p-4">
          <a
            href="/dashboard"
            className="block px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            ← Back to Dashboard
          </a>
        </div>
      </Sidebar>

      <main className="pt-32 md:pl-56">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
          {/* Page Header */}
          <div className="mb-2">
            <h1 className="text-2xl font-semibold text-slate-800">
              My Profile
            </h1>
            <p className="text-slate-500">View your account information</p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">
              {successMessage}
            </div>
          )}

          {/* Error Messages */}
          {(uploadError || updateError) && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4">
              <div className="font-semibold">Error</div>
              <div className="text-sm mt-1">{uploadError || updateError}</div>
            </div>
          )}

          {/* Profile Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header Section with Avatar */}
            <div className="bg-[#0E1D33] h-32"></div>
            <div className="relative px-6 pb-6">
              <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-16">
                {/* Avatar with Upload Button */}
                <div className="relative group">
                  {staffProfile.profile_picture ? (
                    <img
                      src={staffProfile.profile_picture}
                      alt={staffProfile.full_name}
                      className="w-32 h-32 rounded-full border-4 border-white object-cover shadow-lg"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full border-4 border-white bg-sky-500 text-white font-bold text-4xl flex items-center justify-center shadow-lg">
                      {getInitials(staffProfile.full_name)}
                    </div>
                  )}

                  {/* Upload button overlay */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Upload profile picture"
                  >
                    {uploading ? (
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    ) : (
                      <Camera className="w-8 h-8 text-white" />
                    )}
                  </button>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {/* Name and Status */}
                <div className="flex-1 md:mb-2">
                  <h2 className="text-2xl font-bold text-slate-800">
                    {staffProfile.full_name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        staffProfile.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          staffProfile.is_active
                            ? "bg-green-500"
                            : "bg-gray-500"
                        }`}
                      />
                      {staffProfile.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    Hover over your photo to change it
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Information Grid */}
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email - Read Only */}
              <InfoField
                icon={<Mail className="w-5 h-5" />}
                label="Email"
                value={staffProfile.email}
              />

              {/* Phone - Editable */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-gray-100">
                <div className="text-slate-500 mt-0.5">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Phone
                  </div>
                  {isEditingPhone ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="tel"
                        value={phoneValue}
                        onChange={(e) => setPhoneValue(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm font-medium text-slate-800 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                        placeholder="Enter phone number"
                        disabled={savingPhone}
                      />
                      <button
                        onClick={handlePhoneSave}
                        disabled={savingPhone}
                        className="p-1 rounded hover:bg-green-100 text-green-600 disabled:opacity-50"
                        title="Save"
                      >
                        {savingPhone ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={handlePhoneCancel}
                        disabled={savingPhone}
                        className="p-1 rounded hover:bg-rose-100 text-rose-600 disabled:opacity-50"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="text-sm font-medium text-slate-800 flex-1">
                        {staffProfile.phone || "—"}
                      </div>
                      <button
                        onClick={handlePhoneEdit}
                        className="p-1 rounded hover:bg-violet-100 text-violet-600"
                        title="Edit phone number"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Role */}
              <InfoField
                icon={<Shield className="w-5 h-5" />}
                label="Role"
                value={staffProfile.role_name || "No role assigned"}
              />

              {/* Landing Page */}
              <InfoField
                icon={<Home className="w-5 h-5" />}
                label="Landing Page"
                value={staffProfile.landing_page || "/dashboard"}
              />

              {/* Account Created */}
              <InfoField
                icon={<Calendar className="w-5 h-5" />}
                label="Account Created"
                value={formatDate(staffProfile.created_at)}
              />

              {/* Last Login */}
              <InfoField
                icon={<User className="w-5 h-5" />}
                label="Last Login"
                value={formatDateTime(staffProfile.last_login)}
              />
            </div>
          </div>

          {/* Actions Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-2 justify-end">
              <a
                href="/dashboard"
                className="px-4 py-2 rounded-lg border border-gray-200 text-slate-700 hover:bg-slate-50 font-medium"
              >
                Back to Dashboard
              </a>
              <a
                href="/settings"
                className="px-4 py-2 rounded-lg bg-[#0E1D33] text-white hover:bg-[#1a2d4d] font-medium"
              >
                Go to Settings
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoField({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-gray-100">
      <div className="text-slate-500 mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </div>
        <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
      </div>
    </div>
  );
}
