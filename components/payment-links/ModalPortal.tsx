'use client'

import { createPortal } from 'react-dom'

/**
 * Renders a modal at <body>. The payment-link dialogs open from inside other
 * sheets (e.g. PaymentDialog, whose slide-in animation leaves a CSS transform
 * and overflow-hidden on the panel) — a `position: fixed` child there is
 * trapped in the panel and can't scroll. Mounted only after a user action, so
 * `document` always exists.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
