// Shared validation patterns — import from here, do not redefine locally.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_RE = /^[6-9]\d{9}$/
export const NAME_RE = /^[A-Za-z\s.'-]+$/

// Single unified password regex.
// Requires: lowercase, uppercase, digit, and at least one special character.
// Accepted special characters: any non-alphanumeric character.
export const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/
