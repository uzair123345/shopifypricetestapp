# 🔧 Fix Database Connection Error

## The Problem:

Vercel shows: "This project already has an existing environment variable with name DATABASE_URL"

## ✅ Solution:

### Change the Custom Prefix!

In the "Connect Project" dialog:

1. **Change "Custom Prefix"** from `STORAGE` to **`DATABASE`**
   - This tells Vercel to use the standard `DATABASE_URL` variable name
   - Your app code already expects `DATABASE_URL`

2. **Click "Connect"**

---

## Why This Works:

- Your app code uses `DATABASE_URL` (check `app/db.server.ts`)
- Vercel Postgres creates a `DATABASE_URL` automatically
- You just need to connect the database to your project
- Setting prefix to "DATABASE" ensures it uses the correct variable name

---

## After Connecting:

1. Vercel will add `DATABASE_URL` automatically
2. Your app will connect to the database
3. No more "Application Error"! 🎉

---

**Just change "STORAGE" to "DATABASE" in the Custom Prefix field and click Connect!**

