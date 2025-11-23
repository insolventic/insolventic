-- CreateTable
CREATE TABLE "DocumentFromDrive" (
    "id" STRING NOT NULL,
    "googleDriveId" STRING NOT NULL,
    "fileName" STRING NOT NULL,
    "mimeType" STRING NOT NULL,
    "size" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "folderPath" STRING[] DEFAULT ARRAY[]::STRING[],
    "parentFolderId" STRING,
    "isFolder" BOOL NOT NULL DEFAULT false,

    CONSTRAINT "DocumentFromDrive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFromDrive_googleDriveId_key" ON "DocumentFromDrive"("googleDriveId");
