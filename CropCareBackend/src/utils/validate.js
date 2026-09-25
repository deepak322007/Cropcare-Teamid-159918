function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  const digits = phone.trim().replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function normalizePhone(phone) {
  if (typeof phone !== 'string') return '';
  const digits = phone.trim().replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return '';
}

module.exports = { isValidPhone, normalizePhone };
