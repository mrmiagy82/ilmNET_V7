-- CreateIndex
CREATE INDEX "contents_title_idx" ON "contents"("title");

-- CreateIndex
CREATE INDEX "contents_series_idx" ON "contents"("series");

-- CreateIndex
CREATE INDEX "contents_status_type_idx" ON "contents"("status", "type");

-- CreateIndex
CREATE UNIQUE INDEX "contents_provider_externalIdentifier_key" ON "contents"("provider", "externalIdentifier");
