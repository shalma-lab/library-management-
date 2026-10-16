import { initialMember } from "./sampleData";

// The project has no backend, so this file plays the part of the library's
// member-accounts table. It reuses the existing sample member (initialMember)
// and only adds what authentication needs: an email, a salt, and a SALTED
// SHA-256 HASH of the password. The plain-text password is never stored in
// the app; authService hashes what the member types and compares the hashes.
//
// Demo sign-in for the sample member:
//   Member ID: M-1001   (or email: priya.natarajan@athenaeum.example)
//   Password:  Library@2024
//
// When a real backend is added later, only authService.js needs to change.
export const memberAccounts = [
  {
    member: { ...initialMember, email: "priya.natarajan@athenaeum.example" },
    salt: "athenaeum-m1001",
    passwordHash: "5edf6eb22761aa33e95bbe807ec993c0edbb2361b9bffb6ca8699a07a8138388",
  },
];
