export default function NotAuthorized() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Not authorized</h1>
        <p className="text-gray-600">
          You don’t have permission to view this page.
        </p>
      </div>
    </main>
  );
}