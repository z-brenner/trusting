-- CreateEnum
CREATE TYPE "FrameworkStatus" AS ENUM ('CERTIFIED', 'AUDITED', 'SELF_ATTESTED', 'IN_PROGRESS', 'APPLICABLE');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('PRIVACY_POLICY', 'SECURITY_POLICY', 'DATA_PROCESSING_AGREEMENT', 'PENETRATION_TEST', 'AUDIT_REPORT', 'COMPLIANCE_CERTIFICATE', 'INCIDENT_RESPONSE', 'BUSINESS_CONTINUITY', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('PUBLIC', 'REQUEST', 'PRIVATE');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('UPLOAD', 'GOOGLE_DRIVE', 'ONEDRIVE');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE_DRIVE', 'ONEDRIVE');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustCenter" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "websiteUrl" TEXT NOT NULL DEFAULT '',
    "logoKey" TEXT,
    "logoMime" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1f3a5f',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0f766e',
    "address" TEXT NOT NULL DEFAULT '',
    "registrationNumber" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "contactNote" TEXT NOT NULL DEFAULT '',
    "showMap" BOOLEAN NOT NULL DEFAULT true,
    "wizardStep" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentPublicationId" TEXT,

    CONSTRAINT "TrustCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subprocessor" (
    "id" TEXT NOT NULL,
    "trustCenterId" TEXT NOT NULL DEFAULT 'default',
    "vendorSlug" TEXT,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL DEFAULT '',
    "privacyPolicyUrl" TEXT NOT NULL DEFAULT '',
    "services" TEXT NOT NULL DEFAULT '',
    "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dataCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subprocessor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameworkEntry" (
    "id" TEXT NOT NULL,
    "trustCenterId" TEXT NOT NULL DEFAULT 'default',
    "frameworkSlug" TEXT NOT NULL,
    "status" "FrameworkStatus" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "details" JSONB,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrameworkEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameworkDocument" (
    "frameworkEntryId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "FrameworkDocument_pkey" PRIMARY KEY ("frameworkEntryId","documentId")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "trustCenterId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "responsibilities" TEXT NOT NULL DEFAULT '',
    "publishEmail" BOOLEAN NOT NULL DEFAULT false,
    "publishPhone" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "trustCenterId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL DEFAULT '',
    "holderId" TEXT,
    "holderName" TEXT NOT NULL DEFAULT '',
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "credentialId" TEXT NOT NULL DEFAULT '',
    "verificationUrl" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "trustCenterId" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PRIVATE',
    "allowDownload" BOOLEAN NOT NULL DEFAULT true,
    "versionLabel" TEXT NOT NULL DEFAULT '',
    "documentDate" TIMESTAMP(3),
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "source" "DocumentSource" NOT NULL DEFAULT 'UPLOAD',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "grantTokenHash" TEXT,
    "grantExpiresAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequestDocument" (
    "accessRequestId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "AccessRequestDocument_pkey" PRIMARY KEY ("accessRequestId","documentId")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "accountEmail" TEXT NOT NULL DEFAULT '',
    "accountName" TEXT NOT NULL DEFAULT '',
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT NOT NULL DEFAULT '',
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "trustCenterId" TEXT NOT NULL DEFAULT 'default',
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrustCenter_currentPublicationId_key" ON "TrustCenter"("currentPublicationId");

-- CreateIndex
CREATE INDEX "Subprocessor_trustCenterId_idx" ON "Subprocessor"("trustCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "FrameworkEntry_trustCenterId_frameworkSlug_key" ON "FrameworkEntry"("trustCenterId", "frameworkSlug");

-- CreateIndex
CREATE INDEX "Contact_trustCenterId_idx" ON "Contact"("trustCenterId");

-- CreateIndex
CREATE INDEX "Certification_trustCenterId_idx" ON "Certification"("trustCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_trustCenterId_idx" ON "Document"("trustCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_grantTokenHash_key" ON "AccessRequest"("grantTokenHash");

-- CreateIndex
CREATE INDEX "AccessRequest_status_createdAt_idx" ON "AccessRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AccessRequest_requesterEmail_idx" ON "AccessRequest"("requesterEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_provider_key" ON "Integration"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_trustCenterId_version_key" ON "Publication"("trustCenterId", "version");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustCenter" ADD CONSTRAINT "TrustCenter_currentPublicationId_fkey" FOREIGN KEY ("currentPublicationId") REFERENCES "Publication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subprocessor" ADD CONSTRAINT "Subprocessor_trustCenterId_fkey" FOREIGN KEY ("trustCenterId") REFERENCES "TrustCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameworkEntry" ADD CONSTRAINT "FrameworkEntry_trustCenterId_fkey" FOREIGN KEY ("trustCenterId") REFERENCES "TrustCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameworkDocument" ADD CONSTRAINT "FrameworkDocument_frameworkEntryId_fkey" FOREIGN KEY ("frameworkEntryId") REFERENCES "FrameworkEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameworkDocument" ADD CONSTRAINT "FrameworkDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_trustCenterId_fkey" FOREIGN KEY ("trustCenterId") REFERENCES "TrustCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_trustCenterId_fkey" FOREIGN KEY ("trustCenterId") REFERENCES "TrustCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_trustCenterId_fkey" FOREIGN KEY ("trustCenterId") REFERENCES "TrustCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequestDocument" ADD CONSTRAINT "AccessRequestDocument_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "AccessRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequestDocument" ADD CONSTRAINT "AccessRequestDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_trustCenterId_fkey" FOREIGN KEY ("trustCenterId") REFERENCES "TrustCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
