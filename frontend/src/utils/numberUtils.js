/**
 * Number utility functions to safely handle numeric values and prevent NaN errors
 */

/**
 * Safely converts a value to a number, with fallback
 * @param {*} val - Value to convert
 * @param {number} fallback - Fallback value if conversion fails (default: 0)
 * @returns {number} Safe number or fallback
 */
export const safeNumber = (val, fallback = 0) => {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
};

/**
 * Safely converts a value to a fixed decimal string
 * @param {*} val - Value to convert
 * @param {number} decimals - Number of decimal places (default: 2)
 * @param {string} fallback - Fallback string if conversion fails (default: '0.00')
 * @returns {string} Formatted number string or fallback
 */
export const safeToFixed = (val, decimals = 2, fallback = '0.00') => {
  const num = safeNumber(val, null);
  if (num === null) return fallback;
  return num.toFixed(decimals);
};

/**
 * Safely formats a currency value
 * @param {*} val - Value to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted currency string with $ sign
 */
export const safeCurrency = (val, decimals = 2) => {
  return `$${safeToFixed(val, decimals)}`;
};

/**
 * Safely formats a percentage value
 * @param {*} val - Value to format (already in percentage, e.g. 15 for 15%)
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted percentage string with % sign
 */
export const safePercent = (val, decimals = 2) => {
  return `${safeToFixed(val, decimals)}%`;
};
