-- Drop the problematic policies
DROP POLICY IF EXISTS "Accountants can view their firm" ON firms;
DROP POLICY IF EXISTS "Firm owners can manage accountants" ON firm_accountants;

-- Create a security definer function to check firm ownership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_firm_owner(_firm_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM firms
    WHERE id = _firm_id AND owner_id = _user_id
  )
$$;

-- Create a security definer function to check if user is accountant in a firm
CREATE OR REPLACE FUNCTION public.is_firm_accountant(_firm_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM firm_accountants
    WHERE firm_id = _firm_id AND accountant_id = _user_id
  )
$$;

-- Recreate policies using the security definer functions
CREATE POLICY "Accountants can view their firm"
ON firms
FOR SELECT
USING (public.is_firm_accountant(id, auth.uid()));

CREATE POLICY "Firm owners can manage accountants"
ON firm_accountants
FOR ALL
USING (public.is_firm_owner(firm_id, auth.uid()));