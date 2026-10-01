import { describe, expect, it } from "vitest";
import { firmarParametros } from "./firma";

describe("firmarParametros", () => {
  it("reproduce el ejemplo de la documentación de Cloudinary", () => {
    const firma = firmarParametros(
      { timestamp: 1315060510, public_id: "sample_image", eager: "w_400,h_300,c_pad|w_260,h_200,c_crop" },
      "abcd",
    );
    expect(firma).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });

  it("ignora los parámetros que Cloudinary no firma", () => {
    const base = firmarParametros({ timestamp: 1, folder: "x" }, "s");
    expect(firmarParametros({ timestamp: 1, folder: "x", api_key: "123", file: "f" }, "s")).toBe(base);
  });
});
