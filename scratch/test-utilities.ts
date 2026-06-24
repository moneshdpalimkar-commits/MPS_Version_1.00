import { rateLimit } from "../lib/rate-limit";
import { validate } from "../lib/validation";
import { z } from "zod";
import { ValidationError } from "../lib/errors";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function testRateLimiter() {
  console.log("\n--- Testing Rate Limiter ---");
  
  // Test anonymous limit (30 requests/min)
  const ip = "192.168.1.100";
  
  // Call 30 times
  for (let i = 0; i < 30; i++) {
    const res = rateLimit(ip, "anonymous");
    assert(res.success, `Request ${i + 1} should succeed. Remaining: ${res.remaining}`);
  }
  
  // 31st call should fail
  const limitExceededRes = rateLimit(ip, "anonymous");
  assert(!limitExceededRes.success, "Request 31 should be rate limited");
  assert(limitExceededRes.remaining === 0, "Remaining requests should be 0");
  assert(limitExceededRes.limit === 30, "Limit should be 30");

  // Test superadmin limit (120 requests/min)
  const adminId = "admin-user-id";
  for (let i = 0; i < 120; i++) {
    const res = rateLimit(adminId, "superadmin");
    if (i === 0) {
      assert(res.success, "First admin request should succeed");
    }
  }
  const adminLimitExceeded = rateLimit(adminId, "superadmin");
  assert(!adminLimitExceeded.success, "Request 121 for admin should be rate limited");
}

function testValidation() {
  console.log("\n--- Testing Zod Validation Utility ---");
  
  const TestSchema = z.object({
    name: z.string().min(3),
    age: z.number().min(18),
  });

  // Valid data
  const validData = { name: "Alice", age: 25 };
  const validated = validate(TestSchema, validData);
  assert(validated.name === "Alice" && validated.age === 25, "Should validate and return correct data");

  // Invalid data
  try {
    const invalidData = { name: "Bo", age: 15 };
    validate(TestSchema, invalidData);
    assert(false, "Should have thrown ValidationError");
  } catch (err: any) {
    assert(err instanceof ValidationError, "Error should be instance of ValidationError");
    assert(err.code === 400, "Error code should be 400");
    assert(err.message.includes("name") && err.message.includes("age"), "Error message should contain field details");
  }
}

async function runTests() {
  try {
    await testRateLimiter();
    testValidation();
    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n");
  } catch (error) {
    console.error("\n❌ TEST FAILED: ", error);
    process.exit(1);
  }
}

runTests();
