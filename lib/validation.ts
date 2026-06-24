/* eslint-disable @typescript-eslint/no-explicit-any */
import { ZodSchema, ZodIssue } from "zod";
import { ValidationError } from "./errors";

export function validate<T>(schema: ZodSchema<T>, data: any): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMessages = result.error.issues.map((err: ZodIssue) => {
      const pathStr = err.path.join(".");
      return `${pathStr ? `${pathStr}: ` : ""}${err.message}`;
    });
    throw new ValidationError(
      `Validation failed: ${errorMessages.join("; ")}`,
      result.error.flatten()
    );
  }
  return result.data;
}
