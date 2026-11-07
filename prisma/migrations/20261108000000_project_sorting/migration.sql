ALTER TABLE "Project" ADD COLUMN "updatedAt" TIMESTAMPTZ(3);
UPDATE "Project" SET "updatedAt" = "createdAt";
ALTER TABLE "Project" ALTER COLUMN "updatedAt" SET NOT NULL,
                      ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Project_createdAt_id_idx" ON "Project"("createdAt", "id");
CREATE INDEX "Project_updatedAt_id_idx" ON "Project"("updatedAt", "id");
