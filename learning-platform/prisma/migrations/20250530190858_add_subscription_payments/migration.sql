-- CreateTable
CREATE TABLE `subscription_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `planId` INTEGER NOT NULL,
    `amount` DECIMAL(65, 30) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'KES',
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `paymentMethod` VARCHAR(191) NOT NULL DEFAULT 'MPESA',
    `phoneNumber` VARCHAR(191) NOT NULL,
    `mpesaRef` VARCHAR(191) NULL,
    `checkoutRequestId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `metadata` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `subscription_payments` ADD CONSTRAINT `subscription_payments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_payments` ADD CONSTRAINT `subscription_payments_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `subscription_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
