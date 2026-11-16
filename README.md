# Budget AI Dashboard

A full-stack budgeting app with:

- FastAPI backend in `backend/`
- React frontend in `frontend/`
- Supabase PostgreSQL database
- Single-user admin login with a hardened built-in hash
- Gemini-powered receipt OCR and categorization
- Spend management and recurring expense tracking
- Dashboard summaries by month and category

## Stack

- Frontend: React + Vite + CSS
- Backend: FastAPI + Python
- Database: Supabase Postgres
- AI: Gemini API
- Local containerization: Docker Compose

## Quick start with Docker

1. Copy the backend environment example:

   ```bash
   cp backend/.env.example backend/.env
   ```

2. Fill in your Supabase URL and key values in the project root `.env`.
3. Start the app:

   ```bash
   docker compose up --build
   ```

4. Open:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000/docs

## Frontend deploy on Vercel

1. Push the `frontend/` folder to a Vercel project.
2. Set project environment variable:
   - `VITE_API_BASE_URL=https://your-backend-url.example.com`
3. Deploy.

## Supabase setup

1. Open your Supabase project SQL editor.
2. Run the contents of `schema.sql`.
3. Fill in the connection details in the project root `.env`.

## Notes

- Use `SUPABASE_URL` and `SUPABASE_KEY` from the Supabase project.
- Use `GEMINI_API_KEY` in the backend environment only.
- The app does not expose the Gemini key to the frontend or store it in Supabase.

## Backend environment variables

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `GEMINI_API_KEY`
- `FRONTEND_ORIGIN`
- `APP_SECRET` (optional)

## Files to edit

- project root `.env` for runtime config
- `schema.sql` for database creation
- frontend env settings for API URL
