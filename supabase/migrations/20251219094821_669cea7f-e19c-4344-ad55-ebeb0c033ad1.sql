-- Allow clients to create notifications for their assigned accountant
CREATE POLICY "Clients can create notifications for assigned accountant"
ON public.notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.user_id = auth.uid()
    AND c.assigned_accountant_id = notifications.user_id
  )
);

-- Allow clients to create notifications for firm owners
CREATE POLICY "Clients can create notifications for firm owners"
ON public.notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients c
    JOIN firms f ON f.id = c.firm_id
    WHERE c.user_id = auth.uid()
    AND f.owner_id = notifications.user_id
  )
);