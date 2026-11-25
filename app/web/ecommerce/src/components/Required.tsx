/**
 * The red asterisk after the label of a field that must be filled in. Decoration only: the
 * field itself carries `aria-required`, so a screen reader announces "required" once.
 */
export default function Required() {
  return <span className="field-required" aria-hidden="true">*</span>;
}
