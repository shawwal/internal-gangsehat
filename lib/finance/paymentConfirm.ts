// Who may confirm (or reject) a pending payment — someone who can check the
// money actually arrived. Admins record payments, so they don't approve them.
// Mirrored in the DB by trigger transactions_confirm_guard (supabase/129-…).
export const PAYMENT_CONFIRM_ROLES = ['finance', 'manager', 'director']

export const canConfirmPayment = (role: string | null | undefined) =>
  !!role && PAYMENT_CONFIRM_ROLES.includes(role)
