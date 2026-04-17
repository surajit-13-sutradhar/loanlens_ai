// test-db.ts
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Next.js standardizes on .env.local, so we pull those explicitly for this standalone test
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Missing Supabase environment variables.");
  console.error("Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are in your .env.local file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log(`\nInitializing connection to: ${supabaseUrl.split(".")[0]}.supabase.co...`);

  // --- TEST 1: READ / TABLE EXISTENCE ---
  console.log("\nTest 1: Checking if 'loan_sessions' table exists and is readable...");
  const { error: readError } = await supabase
    .from("loan_sessions")
    .select("id")
    .limit(1);

  if (readError) {
    console.error(" Read Test Failed!");
    console.error("Details:", readError.message);
    console.log(" Hint: Did you run the SQL creation script in the Supabase Dashboard?");
    return; // Stop execution if we can't even read
  }
  console.log(" Read Test Passed! Table exists.");

  // --- TEST 2: WRITE ACCESS ---
  console.log("\nTest 2: Attempting to insert a dummy record...");
  const dummyId = crypto.randomUUID();
  const { error: writeError } = await supabase
    .from("loan_sessions")
    .insert([{
      id: dummyId,
      name: "Terminal Test User",
      phone: "555-0100",
      email: "test@terminal.local",
      status: "pending"
    }]);

  if (writeError) {
    console.error(" Write Test Failed!");
    console.error(" Details:", writeError.message);
    console.log(" Hint: If you enabled Row Level Security (RLS) in Supabase, ensure you have an 'Insert' policy allowing anon access.");
    return;
  }
  console.log("Write Test Passed! Successfully inserted data.");

  // --- TEST 3: CLEANUP / DELETE ACCESS ---
  console.log("\n Test 3: Cleaning up the dummy record...");
  const { error: deleteError } = await supabase
    .from("loan_sessions")
    .delete()
    .eq("id", dummyId);

  if (deleteError) {
    console.error("Cleanup Failed!");
    console.error("   Details:", deleteError.message);
    console.log(` The test passed, but you might want to manually delete the row with ID: ${dummyId}`);
  } else {
    console.log(" Cleanup Passed! Database is pristine.");
  }

  console.log("\nALL SYSTEMS GO! Your Supabase connection is fully operational.\n");
}

runTests();