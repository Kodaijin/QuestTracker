// Usernames identify a hero when inviting them to a party. 3–20 chars,
// letters/digits/underscore only; stored and matched lowercased. Lives in a
// plain module (not a 'use server' file, which may only export async functions)
// so it can be shared by server actions and client components alike.
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
