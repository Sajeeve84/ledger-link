-- Drop existing restrictive policies on clients table
DROP POLICY IF EXISTS "Clients can view own record" ON public.clients;
DROP POLICY IF EXISTS "Assigned accountants can view clients" ON public.clients;
DROP POLICY IF EXISTS "Firm owners can manage clients" ON public.clients;

-- Create proper PERMISSIVE policies for authenticated users only
CREATE POLICY "Clients can view own record"
ON public.clients
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Assigned accountants can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (assigned_accountant_id = auth.uid());

CREATE POLICY "Firm owners can manage clients"
ON public.clients
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM firms
  WHERE firms.id = clients.firm_id AND firms.owner_id = auth.uid()
));

-- Also fix the profiles table while we're at it
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);