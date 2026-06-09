export default function Unauthorized() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8 space-y-4 text-center">
        <h1 className="text-4xl font-bold text-red-500">403</h1>
        <h2 className="text-xl font-semibold text-gray-900">Acesso negado</h2>
        <p className="text-gray-500 text-sm">
          Você não tem permissão para acessar esta página.
        </p>
        <a
          href="/login"
          className="inline-block mt-2 text-sm font-medium text-blue-600 hover:underline"
        >
          Voltar para o login
        </a>
      </div>
    </main>
  );
}
