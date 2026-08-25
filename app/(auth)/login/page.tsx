import LoginForm from "./LoginForm";

// searchParams se lee en el servidor y se pasa como prop. Leerlo en el cliente con
// useSearchParams() obligaría a envolver el formulario en un <Suspense>, porque
// fuerza a Next a hacer client-side rendering de la página completa.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Solo se aceptan rutas internas: un `next` como "https://sitio-falso.mx" convertiría
  // el login en un redirector abierto para phishing.
  const destinoSeguro = next?.startsWith("/") && !next.startsWith("//") ? next : null;

  return <LoginForm next={destinoSeguro} />;
}
