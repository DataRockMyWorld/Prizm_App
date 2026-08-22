import { validatePriceAmount } from "./priceValidation";

test("rejects an empty string", () => {
  expect(validatePriceAmount("")).toBeNull();
  expect(validatePriceAmount("   ")).toBeNull();
});

test("rejects zero", () => {
  expect(validatePriceAmount("0")).toBeNull();
});

test("rejects negative amounts", () => {
  expect(validatePriceAmount("-50")).toBeNull();
});

test("rejects non-numeric input", () => {
  expect(validatePriceAmount("abc")).toBeNull();
});

test("accepts a valid positive amount and parses it", () => {
  expect(validatePriceAmount("220")).toBe(220);
  expect(validatePriceAmount("199.50")).toBe(199.5);
});
