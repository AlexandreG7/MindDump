-- CreateTable
CREATE TABLE "EventAssignee" (
    "eventId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,

    CONSTRAINT "EventAssignee_pkey" PRIMARY KEY ("eventId","profileId")
);

-- CreateTable
CREATE TABLE "TodoAssignee" (
    "todoId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,

    CONSTRAINT "TodoAssignee_pkey" PRIMARY KEY ("todoId","profileId")
);

-- CreateIndex
CREATE INDEX "EventAssignee_profileId_idx" ON "EventAssignee"("profileId");

-- CreateIndex
CREATE INDEX "TodoAssignee_profileId_idx" ON "TodoAssignee"("profileId");

-- AddForeignKey
ALTER TABLE "EventAssignee" ADD CONSTRAINT "EventAssignee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAssignee" ADD CONSTRAINT "EventAssignee_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoAssignee" ADD CONSTRAINT "TodoAssignee_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoAssignee" ADD CONSTRAINT "TodoAssignee_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

