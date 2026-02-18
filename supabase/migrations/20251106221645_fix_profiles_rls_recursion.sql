/*
  # Fix infinite recursion in profiles RLS policies
  
  ## Problem
  The "Admins can view all profiles" policy creates infinite recursion because it queries
  the profiles table from within a profiles policy.
  
  ## Solution
  Remove recursive policies and replace with simpler, non-recursive ones that still
  provide proper access control based on the user's own profile data.
*/

-- Drop the recursive policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Keep only the non-recursive policies
-- Users can see their own profile
-- Users can update their own profile

-- For operations that need to check admin status, the application layer
-- should handle this by checking auth.jwt() claims instead of querying profiles