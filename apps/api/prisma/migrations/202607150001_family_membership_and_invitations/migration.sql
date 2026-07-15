-- Evolução do modelo inicial para associação e convites por família.
ALTER TYPE "FamilyStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'FULLY_USED';

ALTER TABLE "Family" RENAME COLUMN "createdBy" TO "createdById";
ALTER TABLE "FamilyMember" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FamilyMember" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "FamilyInvitation" RENAME COLUMN "invitationCode" TO "codeHash";
ALTER TABLE "FamilyInvitation" RENAME COLUMN "createdBy" TO "createdById";
ALTER TABLE "FamilyInvitation" RENAME COLUMN "expirationDate" TO "expiresAt";
ALTER TABLE "FamilyInvitation" ADD COLUMN "codePrefix" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FamilyInvitation" ADD COLUMN "role" "FamilyMemberRole" NOT NULL DEFAULT 'MEMBER';
ALTER TABLE "FamilyInvitation" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FamilyInvitation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
