// API Configuration for PHP Backend
// Update this URL to match your XAMPP setup

export const API_BASE_URL = 'http://localhost/docuflow-api/api';

// Helper to get auth headers
export const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Generic API request helper
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    const json = await response.json();

    if (!response.ok) {
      return { data: null, error: json.error || 'Request failed' };
    }

    return { data: json.data ?? json, error: null };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}

// Auth API
export const authApi = {
  signUp: async (email: string, password: string, fullName: string, role: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/signup.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName, role }),
    });
    return response.json();
  },

  signIn: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  },

  signOut: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/logout.php`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  getSession: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return { user: null, session: null, role: null };

    const response = await fetch(`${API_BASE_URL}/auth/session.php`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },
};

// Firms API
export const firmsApi = {
  get: () => apiRequest<any>('/firms/index.php'),
  create: (data: { name: string; address?: string; phone?: string }) =>
    apiRequest<any>('/firms/index.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Clients API
export const clientsApi = {
  getByFirm: (firmId: string) => apiRequest<any[]>(`/clients/index.php?firm_id=${firmId}`),
  getOwn: () => apiRequest<any[]>('/clients/index.php'),
  create: (data: { user_id: string; firm_id: string; company_name?: string }) =>
    apiRequest<any>('/clients/index.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { assigned_accountant_id?: string; company_name?: string }) =>
    apiRequest<any>(`/clients/index.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Accountants API
export const accountantsApi = {
  getByFirm: (firmId: string) => apiRequest<any[]>(`/accountants/index.php?firm_id=${firmId}`),
  create: (data: { firm_id: string; accountant_id: string }) =>
    apiRequest<any>('/accountants/index.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Documents API
export const documentsApi = {
  getByClient: (clientId: string) => apiRequest<any[]>(`/documents/index.php?client_id=${clientId}`),
  getByFirm: (firmId: string) => apiRequest<any[]>(`/documents/index.php?firm_id=${firmId}`),
  getOwn: () => apiRequest<any[]>('/documents/index.php'),
  create: (data: { client_id: string; file_name: string; file_path: string; file_type?: string; file_size?: number }) =>
    apiRequest<any>('/documents/index.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { status?: string; notes?: string }) =>
    apiRequest<any>(`/documents/index.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Notifications API
export const notificationsApi = {
  get: () => apiRequest<any[]>('/notifications/index.php'),
  create: (data: { user_id: string; title: string; message: string; document_id?: string }) =>
    apiRequest<any>('/notifications/index.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  markRead: (id: string) =>
    apiRequest<any>(`/notifications/index.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_read: true }),
    }),
};

// Invites API
export const invitesApi = {
  validate: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/invites/index.php?token=${token}`);
    return response.json();
  },
  create: (data: { firm_id: string; email: string; role: string }) =>
    apiRequest<any>('/invites/index.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  markUsed: (token: string) =>
    apiRequest<any>(`/invites/index.php?token=${token}`, {
      method: 'PUT',
    }),
};

// Profiles API
export const profilesApi = {
  get: (userId?: string) => apiRequest<any>(userId ? `/profiles/index.php?user_id=${userId}` : '/profiles/index.php'),
  update: (data: { full_name?: string; phone?: string; avatar_url?: string }) =>
    apiRequest<any>('/profiles/index.php', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// File Upload
export const uploadFile = async (file: File, clientId?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  if (clientId) formData.append('client_id', clientId);

  const token = localStorage.getItem('access_token');
  const response = await fetch(`${API_BASE_URL}/upload/index.php`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  return response.json();
};
