// Which Griya branch the /griya-anak pages show. Director and the admin of a
// Griya-enabled branch may switch between every Griya-enabled branch (e.g.
// Griya Anak ↔ Nafaya Centre); everyone else stays on their own branch.
//
// The choice lives in a cookie scoped to GRIYA_PATH, so the browser only sends
// it on /griya-anak requests (pages + their server actions). Both Supabase
// clients forward it as GRIYA_BRANCH_HEADER; get_my_branch() honours it for an
// admin only after checking both branches are Griya-enabled (supabase/130). Every
// other page keeps the admin on their own branch.

export const GRIYA_PATH = '/griya-anak'
export const GRIYA_BRANCH_COOKIE = 'griya_branch'
export const GRIYA_BRANCH_HEADER = 'x-griya-branch'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseGriyaBranch(value: string | null | undefined): string | null {
  return value && UUID_RE.test(value) ? value.toLowerCase() : null
}

export function isGriyaPath(pathname: string): boolean {
  return pathname === GRIYA_PATH || pathname.startsWith(GRIYA_PATH + '/')
}

/** Browser only: the branch picked on /griya-anak (null on any other page). */
export function readGriyaBranchCookie(): string | null {
  if (typeof document === 'undefined' || !isGriyaPath(window.location.pathname)) return null
  const hit = document.cookie.split('; ').find((c) => c.startsWith(GRIYA_BRANCH_COOKIE + '='))
  return parseGriyaBranch(hit ? decodeURIComponent(hit.slice(GRIYA_BRANCH_COOKIE.length + 1)) : null)
}

/** Browser only: remember the branch for /griya-anak (null clears it). */
export function writeGriyaBranchCookie(branchId: string | null) {
  const base = `${GRIYA_BRANCH_COOKIE}=${branchId ? encodeURIComponent(branchId) : ''}; path=${GRIYA_PATH}; SameSite=Lax`
  document.cookie = branchId ? `${base}; max-age=31536000` : `${base}; max-age=0`
}
