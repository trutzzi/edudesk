// SQL pieces shared by several queries, so the JSON the API returns keeps one shape.
// Fixed text only: never put request values in here, they go in as $n parameters.

// A course's teacher as { id, firstName, lastName }, with the teacher joined as `t`
export const TEACHER_JSON = `json_build_object('id', t.id, 'firstName', t.first_name, 'lastName', t.last_name)`;

// A course's dates as YYYY-MM-DD text, with the course as `co`. `::text` keeps them as "2026-09-01";
// pg would otherwise make them local-midnight Dates, which JSON shifts to the previous day in UTC.
export const COURSE_DATES = `co.start_date::text AS "startDate", co.end_date::text AS "endDate"`;
