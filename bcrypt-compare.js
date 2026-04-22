/**
 * One-off: compare a plain password to a bcrypt hash.
 * Run: node bcrypt-compare.js
 */
const bcrypt = require("bcryptjs");

const hash = "$2a$10$JtNp.UgbVFTFlz.nOBKq9eoxFX1Tt17Y/07mK6rxSEU5HDroMxjJu";
const plain = "8RQQCAcTA9RK";

bcrypt.compare(plain, hash).then((ok) => {
  console.log("bcrypt.compare result:", ok);
  process.exit(ok ? 0 : 1);
});
