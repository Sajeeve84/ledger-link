-- Create a trigger function to handle role assignment on signup
-- This will be called from the application after user creation

-- First, add an INSERT policy that allows users to insert their own role
-- The existing policy might be too restrictive if the session isn't ready yet
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

CREATE POLICY "Users can insert own role" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add a policy for service role to insert roles (for trigger-based assignment)
-- This allows the system to assign roles when needed

-- Create INSERT policy for notifications (for accountants to notify clients)
CREATE POLICY "Accountants can create notifications for assigned clients"
ON public.notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.user_id = notifications.user_id
    AND c.assigned_accountant_id = auth.uid()
  )
);

-- Create DELETE policy for notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
USING (user_id = auth.uid());

-- Also allow firm owners to create notifications for their clients
CREATE POLICY "Firm owners can create notifications for their clients"
ON public.notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients c
    JOIN firms f ON f.id = c.firm_id
    WHERE c.user_id = notifications.user_id
    AND f.owner_id = auth.uid()
  )
);