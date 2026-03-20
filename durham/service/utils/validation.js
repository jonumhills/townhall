/**
 * Validation utilities for Durham ADI service
 */

import { ethers } from "ethers";

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address) {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Validate PIN format
 */
export function isValidPin(pin) {
  if (!pin || typeof pin !== "string") return false;
  // Durham PINs can be various formats
  return pin.length > 0 && pin.length < 50;
}

/**
 * Validate county ID
 */
export function isValidCountyId(countyId) {
  const validCounties = ["durham_nc", "raleigh_nc", "charlotte_nc"];
  return validCounties.includes(countyId);
}

/**
 * Validate ADI amount (must be positive number)
 */
export function isValidAdiAmount(amount) {
  const num = Number(amount);
  return !isNaN(num) && num > 0 && Number.isFinite(num);
}

/**
 * Validate share amount (1-1000)
 */
export function isValidShareAmount(amount) {
  const num = Number(amount);
  return Number.isInteger(num) && num > 0 && num <= 1000;
}

/**
 * Sanitize error messages for API responses
 */
export function sanitizeError(error) {
  // Extract meaningful error message from various error types
  if (error?.reason) return error.reason;
  if (error?.message) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
}
