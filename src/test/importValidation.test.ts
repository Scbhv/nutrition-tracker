import { describe, it, expect } from "vitest";
import { validateImportData, ImportDataSchema } from "@/lib/schemas/importValidation";

describe("Import Validation", () => {
  describe("validateImportData", () => {
    it("should validate a minimal valid import with empty arrays", () => {
      const validJson = JSON.stringify({});
      const result = validateImportData(validJson);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.foods).toEqual([]);
      expect(result.data?.logs).toEqual([]);
    });

    it("should validate a complete valid import", () => {
      const validJson = JSON.stringify({
        version: "1.0",
        exportedAt: "2024-01-15T12:00:00.000Z",
        foods: [
          {
            id: "food-123",
            name: "Apple",
            servingSize: 100,
            servingUnit: "g",
            nutrients: { "energy-kcal": 52, proteins: 0.3 },
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        logs: [
          {
            id: "log-123",
            date: "2024-01-15",
            entries: [
              {
                id: "entry-123",
                foodId: "food-123",
                servingAmount: 1.5,
                timestamp: "2024-01-15T08:00:00.000Z",
              },
            ],
          },
        ],
        settings: {
          defaultServingSize: 100,
          dailyGoals: { "energy-kcal": 2000 },
        },
      });

      const result = validateImportData(validJson);
      
      expect(result.success).toBe(true);
      expect(result.data?.foods).toHaveLength(1);
      expect(result.data?.foods[0].name).toBe("Apple");
      expect(result.data?.logs).toHaveLength(1);
      expect(result.data?.settings?.defaultServingSize).toBe(100);
    });

    it("should reject invalid JSON syntax", () => {
      const invalidJson = "{ not valid json";
      const result = validateImportData(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("Invalid JSON");
    });

    it("should reject food with missing required fields", () => {
      const invalidJson = JSON.stringify({
        foods: [
          {
            id: "food-123",
            // missing name
            servingSize: 100,
            servingUnit: "g",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = validateImportData(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("name");
    });

    it("should reject food with empty name", () => {
      const invalidJson = JSON.stringify({
        foods: [
          {
            id: "food-123",
            name: "",
            servingSize: 100,
            servingUnit: "g",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = validateImportData(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("name");
    });

    it("should reject food with negative serving size", () => {
      const invalidJson = JSON.stringify({
        foods: [
          {
            id: "food-123",
            name: "Apple",
            servingSize: -100,
            servingUnit: "g",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = validateImportData(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("servingSize");
    });

    it("should reject food with zero serving size", () => {
      const invalidJson = JSON.stringify({
        foods: [
          {
            id: "food-123",
            name: "Apple",
            servingSize: 0,
            servingUnit: "g",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = validateImportData(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("servingSize");
    });

    it("should reject log with invalid date format", () => {
      const invalidJson = JSON.stringify({
        logs: [
          {
            id: "log-123",
            date: "15-01-2024", // wrong format, should be YYYY-MM-DD
            entries: [],
          },
        ],
      });

      const result = validateImportData(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("date");
    });

    it("should reject entry with negative serving amount", () => {
      const invalidJson = JSON.stringify({
        logs: [
          {
            id: "log-123",
            date: "2024-01-15",
            entries: [
              {
                id: "entry-123",
                foodId: "food-123",
                servingAmount: -1,
                timestamp: "2024-01-15T08:00:00.000Z",
              },
            ],
          },
        ],
      });

      const result = validateImportData(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("servingAmount");
    });

    it("should reject settings with negative default serving size", () => {
      const invalidJson = JSON.stringify({
        settings: {
          defaultServingSize: -50,
          dailyGoals: {},
        },
      });

      const result = validateImportData(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("defaultServingSize");
    });

    it("should reject negative nutrient values", () => {
      const invalidJson = JSON.stringify({
        foods: [
          {
            id: "food-123",
            name: "Apple",
            servingSize: 100,
            servingUnit: "g",
            nutrients: { "energy-kcal": -52 },
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = validateImportData(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("greater than or equal to 0");
    });

    it("should accept food with optional barcode and brand", () => {
      const validJson = JSON.stringify({
        foods: [
          {
            id: "food-123",
            name: "Coca-Cola",
            barcode: "5449000000996",
            brand: "Coca-Cola Company",
            servingSize: 330,
            servingUnit: "ml",
            nutrients: { "energy-kcal": 139, sugars: 35 },
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = validateImportData(validJson);
      
      expect(result.success).toBe(true);
      expect(result.data?.foods[0].barcode).toBe("5449000000996");
      expect(result.data?.foods[0].brand).toBe("Coca-Cola Company");
    });

    it("should accept food with empty nutrients object", () => {
      const validJson = JSON.stringify({
        foods: [
          {
            id: "food-123",
            name: "Unknown Food",
            servingSize: 100,
            servingUnit: "g",
            nutrients: {},
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = validateImportData(validJson);
      
      expect(result.success).toBe(true);
      expect(result.data?.foods[0].nutrients).toEqual({});
    });

    it("should reject food with name exceeding max length", () => {
      const longName = "A".repeat(201);
      const invalidJson = JSON.stringify({
        foods: [
          {
            id: "food-123",
            name: longName,
            servingSize: 100,
            servingUnit: "g",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = validateImportData(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("200");
    });
  });
});
