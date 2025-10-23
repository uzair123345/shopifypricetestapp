-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "auto_install" TEXT NOT NULL DEFAULT 'false',
    "enable_cart_adjustment" TEXT NOT NULL DEFAULT 'false',
    "auto_rotation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_shop_key" ON "settings"("shop");
