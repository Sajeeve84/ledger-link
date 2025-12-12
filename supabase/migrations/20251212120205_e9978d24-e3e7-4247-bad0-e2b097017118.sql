-- First, revoke any public/anon access from profiles table
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM public;

-- Revoke any public/anon access from user_roles table
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.user_roles FROM public;

-- Drop existing policies on profiles and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Firm owners can view accountant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Firm owners can view client profiles" ON public.profiles;
DROP POLICY IF EXISTS "Accountants can view assigned client profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate profiles policies as PERMISSIVE (default)
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Firm owners can view accountant profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM firm_accountants fa
    JOIN firms f ON f.id = fa.firm_id
    WHERE fa.accountant_id = profiles.id AND f.owner_id = auth.uid()
  )
);

CREATE POLICY "Firm owners can view client profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients c
    JOIN firms f ON f.id = c.firm_id
    WHERE c.user_id = profiles.id AND f.owner_id = auth.uid()
  )
);

CREATE POLICY "Accountants can view assigned client profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.user_id = profiles.id AND c.assigned_accountant_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id);

-- Drop and recreate user_roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own role"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);