ALTER TABLE weekly_plan ADD COLUMN plan_date TEXT;

UPDATE weekly_plan
SET plan_date = date(week_start_date, '+' || day_of_week || ' days');

CREATE UNIQUE INDEX idx_weekly_plan_plan_date ON weekly_plan(plan_date);
