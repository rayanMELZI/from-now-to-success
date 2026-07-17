ALTER TABLE habits
    ADD COLUMN schedule VARCHAR(10) NOT NULL DEFAULT 'DAILY';

ALTER TABLE users
    -- "My day ends at 03:00" -> a 01:00 check-in still counts for yesterday.
    ADD COLUMN day_end_hour INT NOT NULL DEFAULT 0,
    -- ISO day-of-week number: 1 = Monday ... 7 = Sunday.
    ADD COLUMN week_start_day INT NOT NULL DEFAULT 1;
