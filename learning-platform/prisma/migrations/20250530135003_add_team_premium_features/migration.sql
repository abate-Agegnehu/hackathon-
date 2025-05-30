-- AlterTable
ALTER TABLE `teams` ADD COLUMN `isPremium` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `premiumFee` DECIMAL(65, 30) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `team_payments` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `amount` DECIMAL(65, 30) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'KES',
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `mpesaRef` VARCHAR(191) NULL,
    `phoneNumber` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `team_payments` ADD CONSTRAINT `team_payments_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_payments` ADD CONSTRAINT `team_payments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
