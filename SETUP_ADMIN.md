# Setting Up Site Owner

You have two options to make your account a site owner:

## Option 1: Run the Node.js Script (Recommended)

This is the easiest method. Run this command in your server directory:

```bash
cd server
node setup-admin.js memegodmidas
```

Replace `memegodmidas` with your actual username.

**Output:**
```
🔍 Looking for user: memegodmidas
👤 Found user:
   Username: memegodmidas
   Email: user@example.com
   Current: Regular User

⚙️  Promoting "memegodmidas" to site owner...

✅ Success! User promoted:
   Username: memegodmidas
   Site Owner: true
   Site Admin: true
```

## Option 2: Use SQL Directly in Database

If you prefer direct database access:

1. Go to https://dashboard.render.com
2. Click **helppy-db** (PostgreSQL database)
3. Click **Query** or connect with a database client
4. Run this SQL (change `memegodmidas` to your username):

```sql
UPDATE "User" 
SET "isSiteOwner" = true, "isSiteAdmin" = true 
WHERE username = 'memegodmidas';
```

Then verify:
```sql
SELECT username, email, "isSiteOwner", "isSiteAdmin" FROM "User" WHERE "isSiteOwner" = true;
```

## Once You're Site Owner

You can now:
- View all users: `GET /api/admin/users`
- Ban users: `POST /api/admin/users/{userId}/ban`
- Timeout users: `POST /api/admin/users/{userId}/timeout`
- Promote other admins: `POST /api/admin/users/{userId}/promote-admin`
- View moderation log: `GET /api/admin/moderation`

Check your admin status: `GET /api/admin/me/admin-status`
