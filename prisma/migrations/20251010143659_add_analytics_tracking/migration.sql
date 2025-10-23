-- CreateTable
CREATE TABLE "view_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" TEXT NOT NULL,
    "variantId" INTEGER,
    "abTestId" INTEGER,
    "sessionId" TEXT NOT NULL,
    "customerId" TEXT,
    "shop" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "isTestPrice" BOOLEAN NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "view_events_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ab_test_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversion_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" TEXT NOT NULL,
    "variantId" INTEGER,
    "abTestId" INTEGER,
    "sessionId" TEXT NOT NULL,
    "customerId" TEXT,
    "shop" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "orderValue" REAL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversion_events_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ab_test_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
