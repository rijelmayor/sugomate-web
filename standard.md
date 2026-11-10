# SUGOMATE UI and Interaction Standards

These standards apply to every new feature and every change to the SUGOMATE web application. Follow them consistently; do not reintroduce previously fixed UI or interaction defects.

## 1. Call-to-action (CTA) feedback is mandatory

Every actionable CTA must provide immediate, visible feedback when activated. Never leave users wondering whether a tap registered.

- **Async form submissions and server actions:** use the framework's pending state (for example, `useFormStatus`) to show a small spinner or progress indicator, change the label to a clear verb phrase (such as "Saving…", "Sending…", or "Placing order…"), disable repeat submission, and restore the control if the operation fails.
- **Client-side async actions:** track loading state, show an inline spinner/progress treatment and a concise pending label, prevent duplicate requests, and surface errors accessibly.
- **Synchronous actions:** provide a clear pressed/active animation and a visible state change (for example, item count, selected state, or "Added"). Do not show a fake loading spinner for an operation that completes synchronously.
- **Navigation links styled as buttons:** retain clear hover, focus-visible, and pressed feedback. If navigation triggers a meaningful asynchronous workflow, use a pending navigation treatment where technically appropriate.
- Keep button dimensions stable while loading. Use `disabled` or `aria-disabled` appropriately, and ensure the pending state is announced to assistive technology.
- Respect `prefers-reduced-motion`; motion must be subtle and must not be the only indication of state.
- Use consistent SUGOMATE styling: readable contrast, clear labels, visible keyboard focus, comfortable touch targets (at least 44px high where practical), and consistent corner radius/spacing.

## 2. Button hierarchy and consistency

- Primary CTA: one visually dominant action per section, using the approved SUGOMATE orange/yellow treatment or navy where the action is a secure/secondary workflow.
- Secondary action: outlined or neutral surface with readable text.
- Destructive action: clearly identified and never styled like a primary purchase/continue action.
- Do not mix unrelated button heights, shapes, or text wrapping within the same navigation/action group.
- Use `type="button"` for non-submit buttons and `type="submit"` only for form submission.
- Never use an unlabeled colored shape as a control. Selected pills/tabs must retain visible text and an accessible selected/current state.

## 3. Responsive layout

- Design and verify at narrow phone widths, common tablet widths (including iPad portrait and landscape), and desktop.
- Prevent horizontal page overflow. Use `min-w-0`, `w-full`, responsive grid/flex layouts, and wrapping or horizontal scrolling intentionally.
- Navigation controls must not become uneven circles, tall pills, or clipped labels. Use consistent minimum heights and predictable wrapping.
- Forms and filters should stack on narrow screens; only use side-by-side layouts when both controls remain comfortably readable.
- Ensure hero content, inputs, selectors, category pills, and CTA buttons remain inside their parent container.
- Avoid empty-looking selected controls. Explicitly set selected text color when necessary and test contrast on actual devices.

## 4. Accessibility and usability

- Every input needs a visible label or an accessible name.
- Every icon-only control needs an accessible label.
- Use `aria-current`, `aria-pressed`, and `aria-live`/status messaging where appropriate.
- Provide visible `:focus-visible` styles and sufficient contrast.
- Error and success messages must be clear, contextual, and associated with the relevant action.
- Do not rely on color or animation alone to communicate state.

## 5. Required review before merge

For every UI/interaction PR, verify:

- [ ] No horizontal overflow at phone and tablet widths.
- [ ] Buttons and CTA labels are visible, aligned, and consistently sized.
- [ ] Every async CTA shows a pending/loading state and blocks duplicate activation.
- [ ] Every synchronous CTA has a clear pressed/selected/result animation or state change.
- [ ] Selected tabs and pills show readable text.
- [ ] Forms, dropdowns, and buttons remain within their containers.
- [ ] Keyboard focus and accessible labels are present.
- [ ] Existing approved branding and page design are preserved unless redesign was explicitly requested.

A PR is not ready to merge until the relevant checks above have been reviewed.

## 6. Merchant incoming-order alerts

- New merchant orders must trigger a clear visual alert and, when the merchant has enabled audio in the current browser session, a repeating audible chime.
- Audio must respect browser autoplay restrictions. Provide an explicit **Enable sound alerts** action and a visible enabled/disabled state; never pretend sound is active when the browser has not allowed it.
- The alert must continue until the merchant explicitly acknowledges it with a clearly labeled confirmation action.
- **Acknowledging an alert is not accepting an order.** It only silences/dismisses the notification. The existing Accept/Reject order workflow remains a separate, explicit merchant decision.
- If several orders arrive before acknowledgement, queue them so acknowledging one does not silently discard the others.
- Do not replay alerts for old pending orders merely because the merchant refreshes or reopens the dashboard. Only newly received orders trigger a new alert; existing pending orders remain visible in the order list.
- Subscribe only to orders belonging to the authenticated merchant memberships and rely on database row-level security. Never expose service-role credentials in the browser.
- Show a visible fallback alert if audio is unavailable or disabled. Do not rely on sound alone.
- Realtime subscriptions must be cleaned up when the merchant dashboard unmounts.


## 7. Literal escape and generated-text artifact prevention

- Never allow source-code escape sequences such as the two visible characters `\\n`, `\\r`, `\\t`, or malformed HTML entities to leak into rendered page text.
- When composing JSX/TSX, use actual source line breaks for formatting. Do not insert a quoted or unquoted literal backslash escape between sibling JSX elements unless the user is intentionally meant to see that exact text.
- Before every PR is marked ready, search all changed `.tsx`, `.jsx`, and relevant `.ts` files for accidental literal escape sequences (especially `\\n`) and inspect each match in context. Distinguish intentional escaped sequences in string literals, regular expressions, tests, and code examples from accidental JSX text nodes.
- Run the production build, lint, and type-check after the scan. Review the rendered preview on customer, merchant, driver, and admin portals, including checkout, order lists/history, and forms touched by the PR.
- Add a visual regression check for stray text such as `\\n`, `\\t`, `undefined`, `[object Object]`, raw template placeholders, and unescaped entity fragments.
- Treat any accidental visible artifact as a release blocker. Do not merge or deploy until it is removed and the preview is rechecked.
