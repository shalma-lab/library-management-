// Reusable form-validation helpers (pure functions, no React).

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Matches the existing member ID style, e.g. "M-1001".
export const MEMBER_ID_PATTERN = /^M-\d{4,6}$/i;

export const PASSWORD_MIN_LENGTH = 8;

export function validateIdentifier(value) {
  const trimmed = value.trim();
  if (!trimmed) return "Enter your Member ID or email address.";

  if (trimmed.includes("@")) {
    return EMAIL_PATTERN.test(trimmed) ? "" : "Enter a valid email address, e.g. name@example.com.";
  }
  return MEMBER_ID_PATTERN.test(trimmed)
    ? ""
    : "Member ID must look like M-1001 (M- followed by 4–6 digits).";
}

export function validatePassword(value) {
  if (!value) return "Enter your password.";
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return "Password must contain at least one letter and one number.";
  }
  return "";
}

export function validateLoginForm({ identifier, password }) {
  const errors = {};
  const identifierError = validateIdentifier(identifier);
  const passwordError = validatePassword(password);
  if (identifierError) errors.identifier = identifierError;
  if (passwordError) errors.password = passwordError;
  return errors;
}
