const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// "/api/classes/4f56…?x=1" → "/api/classes/:id": groups requests by route, and keeps tokens and
// personal details that travel in query strings out of logs
export const normalizePath = (url: string) => (url.split('?')[0] ?? url).replace(UUID, ':id').slice(0, 500);
