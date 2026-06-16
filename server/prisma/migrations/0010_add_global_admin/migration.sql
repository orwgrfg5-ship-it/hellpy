-- AlterTable
ALTER TABLE "User" ADD COLUMN "isSiteOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isSiteAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GlobalModerationAction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GlobalModerationAction_actorId_idx" ON "GlobalModerationAction"("actorId");

-- CreateIndex
CREATE INDEX "GlobalModerationAction_targetId_idx" ON "GlobalModerationAction"("targetId");

-- AddForeignKey
ALTER TABLE "GlobalModerationAction" ADD CONSTRAINT "GlobalModerationAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalModerationAction" ADD CONSTRAINT "GlobalModerationAction_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
