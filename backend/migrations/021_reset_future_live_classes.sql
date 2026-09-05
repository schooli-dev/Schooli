-- Repair classes that were incorrectly marked live before their join window opened.
UPDATE classes
SET status = 'scheduled'::class_status,
    updated_at = NOW()
WHERE status = 'live'
  AND start_time > NOW() + INTERVAL '5 minutes';

UPDATE teacher_work_sessions tws
SET status = 'scheduled',
    updated_at = NOW()
FROM classes c
WHERE c.id = tws.class_id
  AND c.status = 'scheduled'
  AND c.start_time > NOW() + INTERVAL '5 minutes'
  AND tws.status = 'live';

UPDATE video_meetings vm
SET status = 'scheduled'::video_meeting_status,
    updated_at = NOW()
FROM classes c
WHERE c.id = vm.class_id
  AND c.status = 'scheduled'
  AND c.start_time > NOW() + INTERVAL '5 minutes'
  AND vm.status = 'started';
