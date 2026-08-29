export default function XamanLaunchingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-16">
      <section className="w-full rounded-2xl border border-brand-secondary/20 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-brand-primary">
          Preparing Xaman sign-in
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-secondary/90">
          Keep your original CalorieApp tab open. After approval, Xaman may
          return in your default browser; the original tab will finish signing
          in automatically.
        </p>
        <div
          className="mx-auto mt-5 h-6 w-6 animate-spin rounded-full border-2 border-brand-secondary/30 border-t-brand-primary"
          aria-hidden="true"
        />
      </section>
    </main>
  );
}
