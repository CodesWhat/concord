function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-deepest">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-primary-light">Concord</h1>
        <p className="mt-4 text-lg text-text-secondary">
          Open-source community platform
        </p>
        <div className="mt-8 inline-flex items-center gap-2 rounded-lg bg-bg-elevated px-4 py-2 text-sm text-text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          Ready to build
        </div>
      </div>
    </div>
  );
}

export default App;
