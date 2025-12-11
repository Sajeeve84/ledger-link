-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('firm', 'accountant', 'client');

-- Create enum for document status
CREATE TYPE public.document_status AS ENUM ('pending', 'posted', 'clarification_needed', 'resend_requested');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create firms table
CREATE TABLE public.firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create firm_accountants junction table
CREATE TABLE public.firm_accountants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE NOT NULL,
  accountant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (firm_id, accountant_id)
);

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE NOT NULL,
  assigned_accountant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  status document_status DEFAULT 'pending' NOT NULL,
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_accountants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Firms policies
CREATE POLICY "Firm owners can manage their firm" ON public.firms FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Accountants can view their firm" ON public.firms FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.firm_accountants WHERE firm_id = firms.id AND accountant_id = auth.uid())
);

-- Firm accountants policies
CREATE POLICY "Firm owners can manage accountants" ON public.firm_accountants FOR ALL USING (
  EXISTS (SELECT 1 FROM public.firms WHERE id = firm_id AND owner_id = auth.uid())
);
CREATE POLICY "Accountants can view their assignment" ON public.firm_accountants FOR SELECT USING (accountant_id = auth.uid());

-- Clients policies
CREATE POLICY "Firm owners can manage clients" ON public.clients FOR ALL USING (
  EXISTS (SELECT 1 FROM public.firms WHERE id = firm_id AND owner_id = auth.uid())
);
CREATE POLICY "Assigned accountants can view clients" ON public.clients FOR SELECT USING (assigned_accountant_id = auth.uid());
CREATE POLICY "Clients can view own record" ON public.clients FOR SELECT USING (user_id = auth.uid());

-- Documents policies
CREATE POLICY "Clients can upload documents" ON public.documents FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients WHERE id = client_id AND user_id = auth.uid())
);
CREATE POLICY "Clients can view own documents" ON public.documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients WHERE id = client_id AND user_id = auth.uid())
);
CREATE POLICY "Accountants can manage assigned client documents" ON public.documents FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clients c 
    WHERE c.id = documents.client_id AND c.assigned_accountant_id = auth.uid()
  )
);
CREATE POLICY "Firm owners can manage all documents" ON public.documents FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clients c 
    JOIN public.firms f ON f.id = c.firm_id 
    WHERE c.id = documents.client_id AND f.owner_id = auth.uid()
  )
);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- Create trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function for updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_firms_updated_at BEFORE UPDATE ON public.firms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies
CREATE POLICY "Clients can upload to documents bucket" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can view own documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Accountants can view client documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND EXISTS (
    SELECT 1 FROM public.clients c 
    WHERE c.user_id::text = (storage.foldername(name))[1] 
    AND c.assigned_accountant_id = auth.uid()
  )
);
CREATE POLICY "Firm owners can view all documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND EXISTS (
    SELECT 1 FROM public.clients c 
    JOIN public.firms f ON f.id = c.firm_id 
    WHERE c.user_id::text = (storage.foldername(name))[1] 
    AND f.owner_id = auth.uid()
  )
);

-- Enable realtime for documents and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;