/**
 * V6 Accumulation Engine
 *
 * Purpose:
 *   Model superannuation balance growth during working years.
 *
 * Source:
 *   Derived from super-calculator-v4 2.html (reference implementation).
 *
 * Design principles:
 *   - Pure function (no UI, no side effects)
 *   - Deterministic (same inputs → same outputs)
 *   - One row per age / financial year
 *
 * Validation:
 *   Outputs must reconcile to V4.2 and Retirement Plan 2023.xlsx.
 */
