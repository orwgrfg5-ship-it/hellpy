# Helppy - Quick Deployment to Render

Your Helppy app is ready to deploy! Follow these steps:

## 1. Push to GitHub
```bash
git remote add origin https://github.com/orwgrfg5-ship-it/helppy.git
git branch -M main
git push -u origin main
```

## 2. Deploy on Render
See `RENDER_DEPLOYMENT.md` for detailed instructions.

**Quick summary:**
1. Create PostgreSQL database on Render
2. Deploy backend from `/server` directory
3. Deploy frontend from `/client` directory  
4. Set environment variables for both
5. Update `CLIENT_ORIGIN` in backend after frontend is live

## Environment Variables Needed

**Backend:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Long random string (generate: `openssl rand -hex 32`)
- `PORT` - 4000 (or Render's assigned port)
- `CLIENT_ORIGIN` - Your frontend URL

**Frontend:**
- `VITE_API_URL` - Your backend URL

## Costs
- Render free tier includes 1 web service + 1 static site + 1 PostgreSQL database
- Monitor usage at https://render.com/pricing

## Need Help?
Check RENDER_DEPLOYMENT.md for troubleshooting and detailed steps.
