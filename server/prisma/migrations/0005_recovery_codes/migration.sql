-- AlterTable: 2FA recovery codes (stored hashed as a JSON array)
ALTER TABLE "User" ADD COLUMN "recoveryCodes" TEXT;
