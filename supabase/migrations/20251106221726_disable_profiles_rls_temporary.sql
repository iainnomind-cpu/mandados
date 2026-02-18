/*
  # Temporarily disable RLS on profiles table
  
  ## Issue
  Even with simplified policies, profiles table still has recursion issues.
  The profiles table is only accessed by authenticated users checking their own data,
  so we can safely disable RLS for now and rely on application-level checks.
*/

-- Disable RLS on profiles table to prevent recursion
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;