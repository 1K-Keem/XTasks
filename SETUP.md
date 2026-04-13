# XTasks - Database & Authentication Setup Guide

## Overview

This application now includes:
- **Authentication**: User login/signup with NextAuth.js
- **Database**: PostgreSQL with Prisma ORM for task persistence
- **Protected Routes**: Middleware to enforce authentication

## Prerequisites

- Node.js 18+
- PostgreSQL database (local or cloud)
- npm or yarn

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. PostgreSQL Setup
```bash
# Install PostgreSQL: https://www.postgresql.org/download/
# Start PostgreSQL service
# Create a new database
psql -U postgres
CREATE DATABASE xtasks;
```

### 3. Environment Variables

Edit `.env.local` file:

```
# Database Connection String
DATABASE_URL="postgresql://username:password@localhost:5432/xtasks"

# NextAuth Configuration
NEXTAUTH_SECRET="generate-a-random-key-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
```

**Generate NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Create Database Schema

```bash
npx prisma db push
```

This will:
- Create the `users` table for authentication
- Create the `tasks` table for task management
- Set up relationships and indexes

### 6. (Optional) Seed Database

To explore without creating an account:

```bash
npx prisma db seed
```

### 7. Run Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

You will be redirected to `/login` if not authenticated.

## User Features

### Registration
- Click "Sign up" on the login page
- Enter email, name, and password
- Password must be at least 6 characters

### Login
- Use your registered email and password
- Session persists across page reloads

### Task Management
- **Create tasks**: Click the "+" button to add root tasks
- **Edit tasks**: Click task name to rename
- **Add description**: Click "Desc" button
- **Create subtasks**: Click "+" on parent task
- **Mark complete**: Check the checkbox
- **Delete**: Click the delete button

### Visualization
- Toggle between "List" and "Visualize" tabs
- Drag tasks to reorganize
- Create dependencies by dragging from the circle on tasks
- Right-click to open context menu in visualization mode

## Database Schema

### User Table
```
id (UUID)
email (String, unique)
password (String, hashed)
name (String, optional)
createdAt (DateTime)
updatedAt (DateTime)
```

### Task Table
```
id (UUID)
title (String)
description (String, optional)
completed (Boolean)
userId (UUID, FK to User)
parentId (UUID, FK to Task)
createdAt (DateTime)
updatedAt (DateTime)
```

## API Routes

All API routes require authentication (session cookie).

### Tasks
- `GET /api/tasks` - Get all user tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/[id]` - Update task
- `DELETE /api/tasks/[id]` - Delete task

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/[...nextauth]` - NextAuth handlers (signin, signout, etc.)

## Troubleshooting

### Database Connection Error
- Check DATABASE_URL in `.env.local`
- Verify PostgreSQL is running
- Check database user permissions

### Authentication Not Working
- Ensure NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches your domain
- Clear browser cookies and try again

### Tasks Not Saving
- Check browser console for API errors
- Verify user is logged in
- Check network tab in devtools

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/xtasks` |
| `NEXTAUTH_SECRET` | Session encryption key | Output from `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App base URL | `http://localhost:3000` |

## Development Commands

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Prisma Studio (interactive database editor)
npx prisma studio

# View migrations
npx prisma migrate status

# Create new migration
npx prisma migrate dev --name descriptive_name
```

## Security Considerations

- Passwords are hashed using bcryptjs
- Sessions are encrypted using NEXTAUTH_SECRET
- User data is isolated by userId
- All API routes require authentication
- CSRF protection is built-in with NextAuth.js

## Next Steps

1. Deploy to production (Vercel, Railway, etc.)
2. Set up email notifications (optional)
3. Add task sharing features
4. Implement task collaboration
5. Add data export functionality

## Support

For issues or questions, check:
- Prisma docs: https://www.prisma.io/docs/
- NextAuth docs: https://next-auth.js.org/
- Next.js docs: https://nextjs.org/docs
