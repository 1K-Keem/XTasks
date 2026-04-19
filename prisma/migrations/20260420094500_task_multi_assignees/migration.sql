-- Support assigning multiple users to one task.
CREATE TABLE "TaskAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TaskAssignment_taskId_userId_key" ON "TaskAssignment"("taskId", "userId");

-- Preserve existing single-assignee data by migrating it into TaskAssignment.
INSERT INTO "TaskAssignment" ("id", "taskId", "userId")
SELECT lower(hex(randomblob(16))), "id", "assigneeId"
FROM "Task"
WHERE "assigneeId" IS NOT NULL;
