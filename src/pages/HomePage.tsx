function HomePage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="rounded-3xl bg-slate-900 px-8 py-16 text-white md:px-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-300">
          Min egna e-handel
        </p>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          En modern butik byggd med React och TypeScript.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Här kommer kunder att kunna upptäcka produkter, lägga dem i
          varukorgen och skapa en order.
        </p>
      </div>
    </section>
  )
}

export default HomePage