/** Set the same deployment variable for the browser build and the API process. */
declare const process: { env: Record<string, string | undefined> };
export const ATHLETE_SELF_REGISTRATION_ENABLED =
  process.env.NEXT_PUBLIC_ATHLETE_SELF_REGISTRATION_ENABLED === 'true';
