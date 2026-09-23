import "./env";
import { db, officers } from "./index";
import { hashPassword } from "../lib/auth";

/**
 * Create a branch officer. There is no public signup route.
 *   npm run officer:add -- "Name" email@branch.org PASSWORD [admin]
 */
async function main() {
  const [name, email, password, role] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: npm run officer:add -- "Full Name" email@branch.org PASSWORD [admin]');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Password must be at least 10 characters.");
    process.exit(1);
  }

  await db.insert(officers).values({
    name,
    email: email.toLowerCase().trim(),
    passwordHash: hashPassword(password),
    role: role === "admin" ? "admin" : "officer",
  });

  console.log(`Created ${role === "admin" ? "admin" : "officer"}: ${email}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
