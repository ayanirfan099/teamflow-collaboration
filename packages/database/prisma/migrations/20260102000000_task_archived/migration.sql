-- Adds the archived state of a task and the activity types of the M4 milestone.
--
-- A task is either open, done or archived. An archived task is hidden from the board and the
-- list, but it keeps its history (comments, activity) and can be restored. The values are
-- added to the existing enums, so no data is rewritten.

ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'TASK_ARCHIVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'COMMENT_UPDATED';
