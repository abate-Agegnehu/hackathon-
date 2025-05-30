/*
  Warnings:

  - You are about to drop the column `ipAddress` on the `user_activity_logs` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `user_activity_logs` table. All the data in the column will be lost.
  - Made the column `entityType` on table `user_activity_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `entityId` on table `user_activity_logs` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `user_activity_logs` DROP FOREIGN KEY `user_activity_logs_userId_fkey`;

-- AlterTable
ALTER TABLE `user_activity_logs` DROP COLUMN `ipAddress`,
    DROP COLUMN `userAgent`,
    MODIFY `entityType` VARCHAR(191) NOT NULL,
    MODIFY `entityId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `user_activity_logs` ADD CONSTRAINT `user_activity_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
