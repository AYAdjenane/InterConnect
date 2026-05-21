import { getDb } from "../db";
import { calculateMatchScore } from "../controllers/profile.controller";

async function testDatabase() {
  console.log("Starting SQLite DB Verification...");
  const db = await getDb();

  // Clear existing test data if any
  await db.run("DELETE FROM users WHERE email = 'test_student@example.com'");
  await db.run("DELETE FROM users WHERE email = 'test_company@example.com'");

  console.log("Creating test company and student...");
  // 1. Create a company
  const companyUser = await db.run(
    "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
    ["test_company@example.com", "hashed_password", "company"]
  );
  const companyId = companyUser.lastID!;
  await db.run(
    "INSERT INTO company_profiles (user_id, company_name, contact_email) VALUES (?, ?, ?)",
    [companyId, "Acme Tech Solutions", "test_company@example.com"]
  );

  // 2. Create a student
  const studentUser = await db.run(
    "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
    ["test_student@example.com", "hashed_password", "student"]
  );
  const studentId = studentUser.lastID!;
  await db.run(
    "INSERT INTO student_profiles (user_id, full_name, profile_strength, skills) VALUES (?, ?, ?, ?)",
    [studentId, "Jane Doe", 60, "React, TypeScript, CSS"]
  );

  console.log("Posting an offer...");
  // 3. Create an offer
  const offerRes = await db.run(
    `INSERT INTO offers (company_id, title, type, location, description)
     VALUES (?, ?, ?, ?, ?)`,
    [
      companyId,
      "React Frontend Developer",
      "Internship",
      "Remote",
      "Looking for a React developer to build TypeScript components."
    ]
  );
  const offerId = offerRes.lastID!;

  console.log("Verifying skill match score calculation...");
  // 4. Compute and save match score
  const studentSkills = "React, TypeScript, CSS";
  const offerTitle = "React Frontend Developer";
  const offerDesc = "Looking for a React developer to build TypeScript components.";
  
  const score = calculateMatchScore(studentSkills, offerTitle, offerDesc);
  console.log(`Calculated match score: ${score}% (Expected: 70% - base 50% + 2 matches of 'react' and 'typescript')`);

  await db.run(
    "INSERT INTO match_scores (student_id, offer_id, score) VALUES (?, ?, ?)",
    [studentId, offerId, score]
  );

  // 5. Query matching offer
  const result = await db.get(
    `SELECT o.title, ms.score, cp.company_name
     FROM offers o
     JOIN match_scores ms ON ms.offer_id = o.id
     JOIN company_profiles cp ON cp.user_id = o.company_id
     WHERE ms.student_id = ?`,
    [studentId]
  );

  console.log("DB Test Result:", result);
  if (result && result.score === 70) {
    console.log("✅ Database and Skill Matching logic verified successfully!");
  } else {
    console.error("❌ Database verification failed or match score mismatch!");
    process.exit(1);
  }

  // Cleanup
  await db.run("DELETE FROM users WHERE email = 'test_student@example.com'");
  await db.run("DELETE FROM users WHERE email = 'test_company@example.com'");
  console.log("Cleaned up test data.");
  process.exit(0);
}

testDatabase().catch(err => {
  console.error("Fatal error during database test:", err);
  process.exit(1);
});
