// Refleja la política configurada en Supabase (Authentication → Providers → Email).
// Esto es cortesía de interfaz para avisar antes de mandar el formulario; el control
// real lo aplica Supabase en el servidor. Si algún día cambia allá, hay que cambiarlo
// aquí también — de lo contrario la clienta ve un error que no anticipamos.
export function revisarPassword(password: string): string | null {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[a-z]/.test(password)) return "La contraseña debe incluir al menos una minúscula.";
  if (!/[A-Z]/.test(password)) return "La contraseña debe incluir al menos una mayúscula.";
  if (!/[0-9]/.test(password)) return "La contraseña debe incluir al menos un número.";
  return null;
}
