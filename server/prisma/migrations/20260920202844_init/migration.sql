-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('lecture', 'audio', 'video', 'book', 'document');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('youtube', 'archive', 'external', 'google_books', 'pdf');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "SubjectGroup" AS ENUM ('Revelation', 'Practice', 'Belief', 'History', 'Language', 'Character');

-- CreateTable
CREATE TABLE "scholars" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT,
    "specialtyId" TEXT,
    "bio" TEXT,
    "accent" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'published',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scholars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" "SubjectGroup" NOT NULL,
    "description" TEXT,
    "accent" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'published',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contents" (
    "id" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "language" TEXT,
    "thumbnailUrl" TEXT,
    "coverUrl" TEXT,
    "series" TEXT,
    "provider" "Provider" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "externalIdentifier" TEXT,
    "embedUrl" TEXT,
    "collectionIdentifier" TEXT,
    "collectionTitle" TEXT,
    "durationMin" INTEGER,
    "episodes" INTEGER,
    "pages" INTEGER,
    "year" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "importJobId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_scholars" (
    "contentId" TEXT NOT NULL,
    "scholarId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "content_scholars_pkey" PRIMARY KEY ("contentId","scholarId")
);

-- CreateTable
CREATE TABLE "content_subjects" (
    "contentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "content_subjects_pkey" PRIMARY KEY ("contentId","subjectId")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "externalIdentifier" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalItems" INTEGER,
    "importedCount" INTEGER DEFAULT 0,
    "preview" JSONB,
    "error" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scholars_slug_key" ON "scholars"("slug");

-- CreateIndex
CREATE INDEX "scholars_status_idx" ON "scholars"("status");

-- CreateIndex
CREATE INDEX "scholars_specialtyId_idx" ON "scholars"("specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_slug_key" ON "subjects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_key" ON "subjects"("name");

-- CreateIndex
CREATE INDEX "subjects_status_idx" ON "subjects"("status");

-- CreateIndex
CREATE INDEX "subjects_group_idx" ON "subjects"("group");

-- CreateIndex
CREATE UNIQUE INDEX "contents_slug_key" ON "contents"("slug");

-- CreateIndex
CREATE INDEX "contents_status_publishedAt_idx" ON "contents"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "contents_type_provider_idx" ON "contents"("type", "provider");

-- CreateIndex
CREATE INDEX "contents_provider_externalIdentifier_idx" ON "contents"("provider", "externalIdentifier");

-- CreateIndex
CREATE INDEX "contents_collectionIdentifier_idx" ON "contents"("collectionIdentifier");

-- CreateIndex
CREATE INDEX "contents_slug_idx" ON "contents"("slug");

-- CreateIndex
CREATE INDEX "contents_language_idx" ON "contents"("language");

-- CreateIndex
CREATE INDEX "import_jobs_status_provider_idx" ON "import_jobs"("status", "provider");

-- CreateIndex
CREATE INDEX "import_jobs_provider_externalIdentifier_idx" ON "import_jobs"("provider", "externalIdentifier");

-- AddForeignKey
ALTER TABLE "scholars" ADD CONSTRAINT "scholars_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_scholars" ADD CONSTRAINT "content_scholars_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_scholars" ADD CONSTRAINT "content_scholars_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "scholars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_subjects" ADD CONSTRAINT "content_subjects_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_subjects" ADD CONSTRAINT "content_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
