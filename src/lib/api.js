// Fetches and unwraps the public Polyratings professor list. See
// .claude-docs/plan.md §1 for the verified endpoint/response shape.

const PROFESSORS_URL = 'https://api-prod.polyratings.org/professors.all';

// Keep only the fields the extension uses, to keep storage.local small.
function pickFields(professor) {
  return {
    id: professor.id,
    firstName: professor.firstName,
    lastName: professor.lastName,
    department: professor.department,
    overallRating: professor.overallRating,
    numEvals: professor.numEvals,
    courses: professor.courses,
  };
}

export async function fetchProfessors(fetchImpl = fetch) {
  const response = await fetchImpl(PROFESSORS_URL);
  if (!response.ok) {
    throw new Error(`professors.all request failed: ${response.status} ${response.statusText}`);
  }
  const body = await response.json();
  return body.result.data.map(pickFields);
}
