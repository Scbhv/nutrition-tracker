/**
 * Centralized input sanitization utilities for client-side validation.
 */

// Strip control characters and null bytes
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

/** Sanitize a general text input: trim, strip control chars, enforce max length */
export function sanitizeText(input: string, maxLength: number): string {
  return input.replace(CONTROL_CHARS, '').trim().slice(0, maxLength);
}

/** Validate a food name: non-empty, max 200 chars, no script injections */
export function validateFoodName(name: string): { valid: boolean; error?: string } {
  const sanitized = sanitizeText(name, 200);
  if (!sanitized) return { valid: false, error: 'Name is required' };
  if (/<\s*script/i.test(sanitized)) return { valid: false, error: 'Invalid characters in name' };
  return { valid: true };
}

/** Validate barcode: alphanumeric + hyphens only, max 50 chars */
export function validateBarcode(barcode: string): { valid: boolean; error?: string } {
  if (!barcode) return { valid: true }; // optional
  if (barcode.length > 50) return { valid: false, error: 'Barcode too long' };
  if (!/^[a-zA-Z0-9-]+$/.test(barcode)) return { valid: false, error: 'Barcode contains invalid characters' };
  return { valid: true };
}

/** Validate brand: max 100 chars */
export function validateBrand(brand: string): { valid: boolean; error?: string } {
  if (!brand) return { valid: true }; // optional
  if (brand.length > 100) return { valid: false, error: 'Brand name too long' };
  if (/<\s*script/i.test(brand)) return { valid: false, error: 'Invalid characters' };
  return { valid: true };
}

/** Validate serving size: positive finite number, max 100000 */
export function validateServingSize(value: number): { valid: boolean; error?: string } {
  if (!isFinite(value) || value <= 0) return { valid: false, error: 'Serving size must be a positive number' };
  if (value > 100000) return { valid: false, error: 'Serving size too large' };
  return { valid: true };
}

/** Validate serving unit: max 20 chars, alpha + common symbols only */
export function validateServingUnit(unit: string): { valid: boolean; error?: string } {
  if (!unit.trim()) return { valid: false, error: 'Serving unit is required' };
  if (unit.length > 20) return { valid: false, error: 'Serving unit too long' };
  if (!/^[a-zA-Z. /]+$/.test(unit)) return { valid: false, error: 'Invalid serving unit' };
  return { valid: true };
}

/** Validate a nutrient value: non-negative finite number, max 100000 */
export function validateNutrientValue(value: number): boolean {
  return isFinite(value) && value >= 0 && value <= 100000;
}
