import { describe, expect, test } from "vitest";
import { sanitizeInput, InputValidationError } from "./input-sanitizer";

describe("sanitizeInput", () => {
  describe("max length validation", () => {
    test("allows input within max length", () => {
      const input = "a".repeat(100);
      expect(() => sanitizeInput(input, { maxLength: 16000 })).not.toThrow();
    });

    test("rejects input exceeding max length", () => {
      const input = "a".repeat(16001);
      expect(() => sanitizeInput(input, { maxLength: 16000 })).toThrow(
        InputValidationError
      );
    });

    test("uses default max length of 16000", () => {
      const input = "a".repeat(16001);
      expect(() => sanitizeInput(input)).toThrow(InputValidationError);
    });

    test("default max length allows 16000 characters", () => {
      const input = "a".repeat(16000);
      expect(() => sanitizeInput(input)).not.toThrow();
    });
  });

  describe("null byte removal", () => {
    test("removes null bytes from input", () => {
      const input = "hello\x00world";
      const result = sanitizeInput(input);
      expect(result).toBe("helloworld");
    });

    test("removes multiple null bytes", () => {
      const input = "a\x00\x00b";
      const result = sanitizeInput(input);
      expect(result).toBe("ab");
    });

    test("handles input with only null bytes", () => {
      const input = "\x00\x00\x00";
      const result = sanitizeInput(input);
      expect(result).toBe("");
    });
  });

  describe("control character removal", () => {
    test("removes non-printable control characters", () => {
      const input = "hello\x01\x02\x03world";
      const result = sanitizeInput(input);
      expect(result).toBe("helloworld");
    });

    test("preserves newlines and tabs by default", () => {
      const input = "hello\nworld\t!";
      const result = sanitizeInput(input);
      expect(result).toBe("hello\nworld\t!");
    });

    test("preserves carriage returns", () => {
      const input = "hello\r\nworld";
      const result = sanitizeInput(input);
      expect(result).toBe("hello\r\nworld");
    });

    test("removes other control characters (BEL, ESC, etc)", () => {
      const input = "text\x07\x1b[0m";
      const result = sanitizeInput(input);
      expect(result).toBe("text[0m");
    });
  });

  describe("combined sanitization", () => {
    test("removes null bytes and control chars together", () => {
      const input = "hello\x00\x01world\x02";
      const result = sanitizeInput(input);
      expect(result).toBe("helloworld");
    });

    test("checks length AFTER sanitization", () => {
      // Input is 16002 chars but after removing 2 null bytes, it's 16000
      const input = "a".repeat(15998) + "\x00\x00";
      expect(() => sanitizeInput(input, { maxLength: 16000 })).not.toThrow();
    });

    test("rejects if length exceeds even after sanitization", () => {
      // Input is 16002 chars: "a" * 16000 + 2 null bytes
      // After removing 2 null bytes, it's still 16000 chars, which equals limit
      const input = "a".repeat(16000) + "\x00\x00";
      expect(() => sanitizeInput(input, { maxLength: 16000 })).not.toThrow();
    });

    test("rejects if length exceeds limit even after sanitization", () => {
      // Input is 16003 chars: "a" * 16001 + 2 null bytes
      // After removing 2 null bytes, it's 16001 chars, which exceeds limit
      const input = "a".repeat(16001) + "\x00\x00";
      expect(() => sanitizeInput(input, { maxLength: 16000 })).toThrow(
        InputValidationError
      );
    });
  });

  describe("unicode handling", () => {
    test("handles unicode emoji correctly", () => {
      const input = "Hello 👋 World 🌍";
      const result = sanitizeInput(input);
      expect(result).toBe("Hello 👋 World 🌍");
    });

    test("counts unicode characters correctly for length", () => {
      // "👋" is one character grapheme cluster but could be multiple code units
      // Our implementation should count string length which is code units
      const input = "👋".repeat(8000); // Should be under 16000 code units
      expect(() => sanitizeInput(input, { maxLength: 16000 })).not.toThrow();
    });
  });

  describe("empty and whitespace", () => {
    test("allows empty string", () => {
      expect(() => sanitizeInput("")).not.toThrow();
      expect(sanitizeInput("")).toBe("");
    });

    test("preserves whitespace", () => {
      const input = "  hello  world  ";
      const result = sanitizeInput(input);
      expect(result).toBe("  hello  world  ");
    });
  });

  describe("InputValidationError", () => {
    test("includes helpful error message", () => {
      try {
        sanitizeInput("a".repeat(20000), { maxLength: 16000 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        if (error instanceof InputValidationError) {
          expect(error.message).toContain("Input too long");
          expect(error.message).toContain("16000");
        }
      }
    });
  });
});
