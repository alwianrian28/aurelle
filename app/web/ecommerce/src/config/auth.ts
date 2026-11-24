/**
 * Parameter keamanan akun (F-01). FR-01-06 / FR-01-07 menyatakan nilai ini DAPAT DIATUR
 * dari Pengaturan (F-26). Angka di bawah hanya default demo, bukan keputusan final.
 * Penegakan sesungguhnya ada di backend — pembatasan di klien hanya untuk UX.
 */
export const AUTH_PARAMS = {
  /** Masa berlaku tautan reset password (menit). */
  resetTokenTtlMin: 15,
  /** Masa berlaku tautan verifikasi email (menit). */
  verifyTokenTtlMin: 24 * 60,
  /** Jeda kirim ulang email (detik). */
  resendCooldownSec: 60,
  /** N percobaan login gagal sebelum dibatasi (AC-01-06). */
  loginMaxAttempts: 5,
  /** Lama pembatasan setelah N kali gagal (detik). */
  loginLockSec: 60,
} as const;
