/*
  Warnings:

  - You are about to drop the column `abTestProductId` on the `ab_test_variants` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ab_test_variants" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "abTestId" INTEGER NOT NULL,
    "productId" TEXT,
    "variantName" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "discount" REAL,
    "trafficPercent" REAL NOT NULL,
    "isBaseVariant" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ab_test_variants_abTestId_fkey" FOREIGN KEY ("abTestId") REFERENCES "ab_tests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ab_test_variants" ("abTestId", "discount", "id", "isBaseVariant", "price", "trafficPercent", "variantName") SELECT "abTestId", "discount", "id", "isBaseVariant", "price", "trafficPercent", "variantName" FROM "ab_test_variants";
DROP TABLE "ab_test_variants";
ALTER TABLE "new_ab_test_variants" RENAME TO "ab_test_variants";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
