CREATE UNIQUE INDEX "one_default_address_per_user"
ON "Address" ("userId")
WHERE "isDefault" = true;