const crypto = require('crypto');

/**
 * Temporary passwords a manager reads out over the phone or copies into a text
 * message, so legibility matters as much as entropy.
 *
 * The alphabet drops every pair that is mistaken for another when spoken or
 * hand-written: i/j/l/1, o/0, u/v. Hyphenated groups of four survive being read
 * aloud and typed back, which a 12-character run does not.
 *
 * 25 usable symbols over 12 characters is about 56 bits. That is far beyond
 * guessing for a credential that only lives until the resident's first sign-in,
 * at which point must_change_password forces it to be replaced.
 */
const ALPHABET = 'abcdefghkmnpqrstwxyz23456789';
const GROUPS = 3;
const GROUP_LENGTH = 4;

const generate = () => {
  const groups = [];
  for (let g = 0; g < GROUPS; g += 1) {
    let group = '';
    for (let c = 0; c < GROUP_LENGTH; c += 1) {
      // randomInt is rejection-sampled, so no modulo bias across the alphabet.
      group += ALPHABET[crypto.randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join('-');
};

module.exports = { generate, ALPHABET };
