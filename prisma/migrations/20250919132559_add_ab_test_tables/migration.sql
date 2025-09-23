-- CreateTable
CREATE TABLE "ab_tests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "basePrice" REAL NOT NULL,
    "baseTrafficPercent" REAL NOT NULL,
    "totalTrafficPercent" REAL NOT NULL DEFAULT 100.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "endedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ab_test_products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "abTestId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productHandle" TEXT NOT NULL,
    "basePrice" REAL NOT NULL,
    CONSTRAINT "ab_test_products_abTestId_fkey" FOREIGN KEY ("abTestId") REFERENCES "ab_tests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ab_test_variants" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "abTestId" INTEGER NOT NULL,
    "variantName" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "discount" REAL,
    "trafficPercent" REAL NOT NULL,
    "isBaseVariant" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ab_test_variants_abTestId_fkey" FOREIGN KEY ("abTestId") REFERENCES "ab_tests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
