import { describe, expect, it } from "vitest";
import { firmarJwtHs256 } from "./jwt";

describe("firmarJwtHs256", () => {
  it("reproduce el token de ejemplo de jwt.io", () => {
    const token = firmarJwtHs256(
      { sub: "1234567890", name: "John Doe", iat: 1516239022 },
      "your-256-bit-secret",
    );
    expect(token).toBe(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    );
  });

  it("cambia la firma si cambia el secreto", () => {
    const a = firmarJwtHs256({ sub: "u" }, "secreto-a");
    const b = firmarJwtHs256({ sub: "u" }, "secreto-b");
    expect(a.split(".")[2]).not.toBe(b.split(".")[2]);
  });
});
