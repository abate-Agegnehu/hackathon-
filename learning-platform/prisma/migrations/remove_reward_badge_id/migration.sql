-- Drop the foreign key constraint if it exists
SET FOREIGN_KEY_CHECKS=0;
ALTER TABLE `challenges` DROP FOREIGN KEY `challenges_rewardBadgeId_fkey`;
SET FOREIGN_KEY_CHECKS=1;

-- Drop the rewardBadgeId column
ALTER TABLE `challenges` DROP COLUMN `rewardBadgeId`; 