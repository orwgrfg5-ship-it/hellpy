-- SQL Script: Make a user a site owner and admin
-- This script directly updates the database

-- Option 1: By username (EDIT THIS)
UPDATE "User" 
SET "isSiteOwner" = true, "isSiteAdmin" = true 
WHERE username = 'memegodmidas';

-- Option 2: By email (uncomment and edit if needed)
-- UPDATE "User" 
-- SET "isSiteOwner" = true, "isSiteAdmin" = true 
-- WHERE email = 'your-email@example.com';

-- Verify the change
SELECT username, email, "isSiteOwner", "isSiteAdmin" FROM "User" WHERE "isSiteOwner" = true;
