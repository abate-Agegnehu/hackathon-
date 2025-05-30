-- AlterTable
ALTER TABLE `team_payments` ADD COLUMN `checkoutRequestId` VARCHAR(191) NULL,
    ADD COLUMN `metadata` JSON NULL;
