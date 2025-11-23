-- CreateTable
CREATE TABLE "notifications" (
    "id" STRING NOT NULL,
    "type" STRING NOT NULL,
    "title" STRING NOT NULL,
    "message" STRING NOT NULL,
    "priority" STRING NOT NULL,
    "read" BOOL NOT NULL DEFAULT false,
    "userId" STRING NOT NULL,
    "caseId" STRING,
    "relatedId" STRING,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readDate" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
