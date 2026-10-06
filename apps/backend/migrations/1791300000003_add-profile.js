/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumns('users', {
    // The app's language for this person, applied when they sign in; null follows the browser
    locale: { type: 'varchar(2)', check: "locale IN ('ro', 'en')" },
    // About the person, e.g. a therapist's experience or a client's situation; staff see it on their card
    details: { type: 'text' },
    // Free notes, kept with the account; the person and the institution's staff see them
    notes: { type: 'text' },
  });
};

export const down = (pgm) => {
  pgm.dropColumns('users', ['locale', 'details', 'notes']);
};
