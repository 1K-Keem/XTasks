-- Add project-wide interaction lock flag for synchronized canvas lock state
ALTER TABLE "Project" ADD COLUMN "interactionLocked" BOOLEAN NOT NULL DEFAULT false;
