# PHP Backend for DocuFlow

This is the PHP/MySQL backend for DocuFlow. It replaces Supabase with a self-hosted solution.

## Setup Instructions

### 1. Database Setup

1. Open phpMyAdmin (http://localhost/phpmyadmin)
2. Import the schema file: `backend/database/schema.sql`
   - Or run it manually in the SQL tab

### 2. Configure Apache/XAMPP

1. Copy the `backend` folder to your XAMPP htdocs directory:
   ```
   C:\xampp\htdocs\docuflow-api\
   ```

2. Make sure Apache is running in XAMPP Control Panel

3. The API will be available at: `http://localhost/docuflow-api/api/`

### 3. Configure CORS (if needed)

Edit `backend/config/database.php` and update `ALLOWED_ORIGINS` with your frontend URL.

### 4. Create uploads directory

Create the uploads folder and ensure it's writable:
```
backend/uploads/
```

## API Endpoints

### Authentication
- `POST /api/auth/signup.php` - Register new user
- `POST /api/auth/login.php` - Login
- `POST /api/auth/logout.php` - Logout
- `GET /api/auth/session.php` - Get current session

### Firms
- `GET /api/firms/` - Get firm for current user
- `POST /api/firms/` - Create firm

### Clients
- `GET /api/clients/?firm_id=xxx` - Get clients for firm
- `POST /api/clients/` - Create client
- `PUT /api/clients/?id=xxx` - Update client

### Accountants
- `GET /api/accountants/?firm_id=xxx` - Get accountants for firm
- `POST /api/accountants/` - Add accountant to firm

### Documents
- `GET /api/documents/?client_id=xxx` - Get documents
- `POST /api/documents/` - Create document record
- `PUT /api/documents/?id=xxx` - Update document

### Notifications
- `GET /api/notifications/` - Get user notifications
- `POST /api/notifications/` - Create notification
- `PUT /api/notifications/?id=xxx` - Mark as read

### Invites
- `GET /api/invites/?token=xxx` - Validate invite token
- `POST /api/invites/` - Create invite
- `PUT /api/invites/?token=xxx` - Mark token as used

### Profiles
- `GET /api/profiles/` - Get profile
- `PUT /api/profiles/` - Update profile

### File Upload
- `POST /api/upload/` - Upload file (multipart/form-data)

## Security Notes

1. Change `JWT_SECRET` in `config/database.php` for production
2. Use HTTPS in production
3. Implement rate limiting for production use
