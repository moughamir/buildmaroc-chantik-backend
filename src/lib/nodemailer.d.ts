// nodemailer ships no bundled types and @types/nodemailer is not installed.
// Shorthand ambient declaration — the nodemailer surface is typed `any` in
// src/lib/email.ts so `bunx tsc --noEmit` stays clean without package.json
// changes. Remove once @types/nodemailer is added.
declare module 'nodemailer';
