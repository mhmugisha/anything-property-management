# Authentication Session Fix - Implementation Guide

## Problem
When users sign out and sign back in as a different user, the React Query cache persists data from the previous user, causing:
- Wrong avatar/profile picture showing
- Wrong permissions being enforced
- Access denied errors for admin users

## Root Cause
1. `useStaffProfile` query key was `["staffProfile"]` - same for all users
2. No cache invalidation on sign-in/sign-out
3. Cached data persists across different user sessions

## Solution Implemented

### 1. Updated `useStaffProfile` Hook ✅
**File:** `/apps/web/src/hooks/useStaffProfile.js`
- Added `userId` parameter to query key: `["staffProfile", userId]`
- Each user now has their own isolated cache

```javascript
export function useStaffProfile(enabled, userId = null) {
  return useQuery({
    queryKey: ["staffProfile", userId],
    queryFn: async () => {
      const data = await fetchJson("/api/staff/profile");
      return data.staff;
    },
    enabled,
  });
}
```

### 2. Clear Cache on Logout ✅
**File:** `/apps/web/src/app/account/logout/page.jsx`
- Added `queryClient.clear()` before sign out

```javascript
import { useQueryClient } from "@tanstack/react-query";

// In component:
const queryClient = useQueryClient();
queryClient.clear(); // Clears all cached data
await signOut(...);
```

### 3. Clear Cache on Sign-In ✅
**File:** `/apps/web/src/app/account/signin/page.jsx`
- Added `queryClient.clear()` before sign in

### 4. Updated AppHeader ✅
**File:** `/apps/web/src/components/Shell/AppHeader.jsx`
- Now passes `user?.id` to `useStaffProfile`

```javascript
const staffProfileQuery = useStaffProfile(!!user, user?.id);
```

## Files That Need Manual Updates

All pages that call `useStaffProfile` need to pass `user?.id`:

### Pattern to Follow:
```javascript
// OLD (wrong):
const staffQuery = useStaffProfile(!userLoading && !!user);

// NEW (correct):
const staffQuery = useStaffProfile(!userLoading && !!user, user?.id);
```

### Files to Update:
1. `/apps/web/src/app/dashboard/page.jsx` - line ~44
2. `/apps/web/src/app/settings/page.jsx` - line ~20
3. `/apps/web/src/app/profile/page.jsx` - line ~38
4. `/apps/web/src/app/landlords/page.jsx` - line ~47
5. `/apps/web/src/app/properties/page.jsx` - line ~66
6. `/apps/web/src/app/tenants/page.jsx` (if applicable)
7. `/apps/web/src/app/payments/page.jsx` - line ~17
8. `/apps/web/src/app/reports/page.jsx` (if applicable)
9. `/apps/web/src/app/accounting/page.jsx` - line ~35
10. `/apps/web/src/app/maintenance/page.jsx` - line ~39
11. All accounting sub-pages in `/apps/web/src/app/accounting/*/page.jsx`

## Quick Fix Script
For each file listed above, find this line:
```javascript
const staffQuery = useStaffProfile(!userLoading && !!user);
```

Replace with:
```javascript
const staffQuery = useStaffProfile(!userLoading && !!user, user?.id);
```

OR find variations like:
```javascript
const staffProfileQuery = useStaffProfile(queriesEnabled);
```

Replace with:
```javascript
const staffProfileQuery = useStaffProfile(queriesEnabled, user?.id);
```

## Testing
After fixing:
1. Sign in as Admin
2. Note the avatar/profile picture
3. Sign out
4. Sign in as different user
5. Verify new user's avatar shows
6. Verify correct permissions apply
7. Sign out
8. Sign in as Admin again
9. Verify Admin avatar shows
10. Verify Admin can access Settings

## Why This Works
- Each user gets their own cache namespace via `["staffProfile", userId]`
- Cache is cleared on auth transitions
- No stale data can persist across sessions
- Immediate data refresh on sign-in

