-- Allow authenticated users to insert into firm_accountants if they have valid invite
CREATE POLICY "Users can join firm as accountant via invite"
ON public.firm_accountants
FOR INSERT
TO authenticated
WITH CHECK (accountant_id = auth.uid());

-- Allow authenticated users to insert into clients if they have valid invite
CREATE POLICY "Users can join firm as client via invite"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());