-- Add meetLink and googleEventId columns to sessions table
ALTER TABLE `sessions` ADD COLUMN `meetLink` TEXT NULL;
ALTER TABLE `sessions` ADD COLUMN `googleEventId` VARCHAR(255) NULL; 