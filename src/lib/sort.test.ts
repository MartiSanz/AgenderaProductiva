import { describe, expect, it } from "vitest";
import { sortByName } from "./sort";

describe("sortByName", () => {
  it("ordena A→Z sin distinguir mayúsculas ni acentos", () => {
    expect(sortByName(["micaela", "Álvarez", "Zoe", "Beto"], (x) => x)).toEqual(["Álvarez", "Beto", "micaela", "Zoe"]);
  });
});
