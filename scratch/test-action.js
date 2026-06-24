const { createClient } = require('@supabase/supabase-js');

// Load env variables
require('dotenv').config({ path: './.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log("Starting Supabase update test in workspace...");
  
  const { data, error } = await supabaseAdmin
    .from("staff")
    .update({
      employee_id: "MPS_001",
      department_id: "d7909e98-542d-4b6b-a374-6898f65b74c7",
      first_name: "Monesh",
      last_name: "Palimkar",
      phone: "8600510958",
      address: "Nanded",
      blood_group: "A+",
      emergency_contact: "7709586644",
      staff_role: "teaching",
      designation: "Math",
      join_date: "2026-06-11",
    })
    .eq("id", "82ae3166-85b8-444e-a4ba-f19b2246286f")
    .select();

  if (error) {
    console.error("Update failed:", error.message);
  } else {
    console.log("Update succeeded! Row updated:", data);
  }
}

test().catch(console.error);
