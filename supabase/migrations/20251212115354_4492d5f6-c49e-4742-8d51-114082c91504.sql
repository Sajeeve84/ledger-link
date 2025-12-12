-- Drop existing restrictive policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create PERMISSIVE policies for profiles table

-- 1. Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Firm owners can view profiles of their accountants
CREATE POLICY "Firm owners can view accountant profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM firm_accountants fa
    JOIN firms f ON f.id = fa.firm_id
    WHERE fa.accountant_id = profiles.id
    AND f.owner_id = auth.uid()
  )
);

-- 3. Firm owners can view profiles of their clients
CREATE POLICY "Firm owners can view client profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients c
    JOIN firms f ON f.id = c.firm_id
    WHERE c.user_id = profiles.id
    AND f.owner_id = auth.uid()
  )
);

-- 4. Accountants can view profiles of their assigned clients
CREATE POLICY "Accountants can view assigned client profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.user_id = profiles.id
    AND c.assigned_accountant_id = auth.uid()
  )
);

-- 5. Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 6. Users can update their own profile only
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);