# Render Deployment Guide for Helppy

## Prerequisites
- GitHub repository with your Helppy code
- Render account (https://render.com)

## Step 1: Create PostgreSQL Database on Render

1. Sign in to Render Dashboard
2. Click **New +** > **PostgreSQL**
3. Fill in:
   - **Name**: `helppy-db`
   - **Database**: `helppy`
   - **User**: `helppy`
   - **Region**: Choose closest to you
   - **Plan**: Free tier (if available)
4. Click **Create Database**
5. Copy the **Internal Database URL** (will look like `postgresql://...@dpg-...internal:5432/helppy`)

## Step 2: Deploy Backend (API Server)

1. Click **New +** > **Web Service**
2. Connect to your GitHub repository
3. Fill in:
   - **Name**: `helppy-api`
   - **Environment**: `Node`
   - **Region**: Same as database
   - **Build Command**: `cd server && npm install && npx prisma generate && npx prisma migrate deploy`
   - **Start Command**: `cd server && node src/index.js`
   - **Plan**: Free tier (if available)
4. Click **Advanced** and add **Environment Variables**:
   ```
   DATABASE_URL=<paste the internal database URL from Step 1>
   JWT_SECRET=<generate with: openssl rand -hex 32>
   PORT=4000
   CLIENT_ORIGIN=https://helppy-client.onrender.com
   NODE_ENV=production
   ```
5. Click **Create Web Service**
6. Wait for deployment to complete
7. Note the API URL (e.g., `https://helppy-api.onrender.com`)

## Step 3: Deploy Frontend (React App)

1. Click **New +** > **Static Site**
2. Connect to your GitHub repository
3. Fill in:
   - **Name**: `helppy-client`
   - **Build Command**: `cd client && npm install && npm run build`
   - **Publish Directory**: `client/dist`
4. Click **Advanced** and add **Environment Variables**:
   ```
   VITE_API_URL=https://helppy-api.onrender.com
   ```
5. Click **Create Static Site**
6. Wait for deployment

## Step 4: Update Backend Environment Variables

1. Go back to your API service (`helppy-api`)
2. Click **Environment** in the left sidebar
3. Update `CLIENT_ORIGIN` to your frontend URL (e.g., `https://helppy-client.onrender.com`)
4. Redeploy by clicking **Manual Deploy** > **Latest Deployment**

## Step 5: Access Your App

- Frontend: `https://helppy-client.onrender.com`
- API: `https://helppy-api.onrender.com/health`

## Custom Domain (Optional)

1. Go to your service in Render
2. Click **Settings** > **Custom Domain**
3. Add your domain and follow DNS setup instructions

## Troubleshooting

- **Database connection fails**: Ensure DATABASE_URL uses the **internal** URL
- **CORS errors**: Check that `CLIENT_ORIGIN` matches your frontend URL exactly
- **Migrations fail**: Check the logs in Render > Service > Logs
