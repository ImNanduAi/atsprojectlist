export const fail = (msg, status = 400) => Response.json({ error: msg }, { status });
/** Runs a route handler and turns an unexpected error into a readable JSON message. */
export async function safe(fn) {
  try { return await fn(); }
  catch (e) {
    console.error(e);
    return fail(e?.message || 'Something went wrong.', 500);
  }
}
