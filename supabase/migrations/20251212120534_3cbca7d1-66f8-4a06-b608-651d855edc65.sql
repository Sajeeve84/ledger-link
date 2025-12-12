-- Create invite_tokens table for secure invite handling
CREATE TABLE public.invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '48 hours'),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

-- Only firm owners can create invite tokens
CREATE POLICY "Firm owners can create invite tokens"
ON public.invite_tokens FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.firms
        WHERE firms.id = invite_tokens.firm_id
        AND firms.owner_id = auth.uid()
    )
    AND created_by = auth.uid()
);

-- Firm owners can view their tokens
CREATE POLICY "Firm owners can view invite tokens"
ON public.invite_tokens FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.firms
        WHERE firms.id = invite_tokens.firm_id
        AND firms.owner_id = auth.uid()
    )
);

-- Allow anyone to read unexpired, unused tokens (for invite validation)
CREATE POLICY "Anyone can validate invite tokens"
ON public.invite_tokens FOR SELECT
USING (
    used_at IS NULL 
    AND expires_at > now()
);

-- Firm owners can delete their tokens
CREATE POLICY "Firm owners can delete invite tokens"
ON public.invite_tokens FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.firms
        WHERE firms.id = invite_tokens.firm_id
        AND firms.owner_id = auth.uid()
    )
);

-- Allow marking token as used (update used_at)
CREATE POLICY "Users can mark token as used"
ON public.invite_tokens FOR UPDATE TO authenticated
USING (used_at IS NULL AND expires_at > now())
WITH CHECK (used_at IS NOT NULL);