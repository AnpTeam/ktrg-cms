-- Every course has a rally of its own (the seed made one for each of the first 19; the admin now makes one when a course is
-- created). Courses created before that have none: give each a published rally of courses holding just that course,
-- named like the course, after the existing rallies. A course that already belongs to any rally is left alone, so running
-- this again changes nothing.
WITH missing AS (
  SELECT r.id AS route_id, gen_random_uuid() AS rally_id, row_number() OVER (ORDER BY r.sort_order, r.created_at) AS n
  FROM routes r
  WHERE NOT EXISTS (SELECT 1 FROM rally_routes rr WHERE rr.route_id = r.id)
),
base AS (SELECT coalesce(max(sort_order), 0) AS top FROM rallies),
made AS (
  INSERT INTO rallies (id, kind, sort_order, published)
  SELECT m.rally_id, 'course', base.top + m.n, true FROM missing m CROSS JOIN base
  RETURNING id
),
names AS (
  INSERT INTO rally_translations (rally_id, locale, name)
  SELECT m.rally_id, t.locale, t.name
  FROM missing m JOIN route_translations t ON t.route_id = m.route_id
  WHERE t.locale IN ('ja', 'en') AND t.name IS NOT NULL AND t.name <> ''
  RETURNING rally_id
)
INSERT INTO rally_routes (rally_id, route_id, position)
SELECT m.rally_id, m.route_id, 1 FROM missing m;
