"use client";

import { useState } from "react";
import { ArrowRight, Download, Menu, Package, ShoppingBag, Store, Truck, X } from "lucide-react";

const services = [
  { icon: ShoppingBag, name: "Food & groceries", detail: "Everyday essentials from nearby shops." },
  { icon: Package, name: "Pabili & parcels", detail: "Send a request or get a package delivered." },
  { icon: Truck, name: "Errands & more", detail: "A helping hand for everyday tasks." },
];

const ecosystem = [
  { icon: ShoppingBag, title: "For customers", copy: "One simple place to order, request, and arrange local deliveries.", href: "/register" },
  { icon: Store, title: "For local businesses", copy: "Help more people discover your store and make ordering easier.", href: "/register/merchant" },
  { icon: Truck, title: "For delivery partners", copy: "Connect with local delivery requests and serve your community.", href: "/register/driver" },
];

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const nav = [{ label: "Services", href: "#services" }, { label: "Our ecosystem", href: "#ecosystem" }, { label: "Coverage", href: "#coverage" }];

  return <main className="min-h-screen bg-white text-[#102e57]">
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[82px] w-[min(1160px,calc(100%-40px))] items-center justify-between gap-3">
        <a href="#home" aria-label="SUGOMATE home" className="flex items-center">
          <img src="/images/sugomate-eagle-road-logo.png" alt="SUGOMATE — Imong sugo, kami bahala." className="h-[54px] w-auto max-w-[min(260px,28vw)] object-contain object-left" />
        </a>
        <nav className="hidden shrink-0 items-center gap-4 whitespace-nowrap md:flex">{nav.map(item => <a key={item.href} href={item.href} className="group relative py-2 text-sm font-semibold text-slate-600 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-orange-600 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-gradient-to-r after:from-[#ff8a00] after:to-[#f0441c] after:transition-transform after:duration-200 hover:after:scale-x-100">{item.label}</a>)}<a href="/login" className="relative py-2 text-sm font-extrabold text-[#102e57] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-orange-600">Sign in</a><a href="/register" className="whitespace-nowrap rounded-full bg-gradient-to-r from-[#ff8a00] to-[#f0441c] px-4 py-3 text-sm font-extrabold text-white shadow-md shadow-orange-200 transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.03] hover:shadow-xl hover:shadow-orange-300/60 active:translate-y-0 active:scale-100">Create account</a></nav>
        <button onClick={() => setDownloadOpen(true)} className="hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#ff8a00] to-[#f0441c] px-4 py-3 text-sm font-extrabold text-white shadow-md shadow-orange-200 transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.03] hover:shadow-xl hover:shadow-orange-300/60 active:translate-y-0 active:scale-100 md:inline-flex"><Download size={16}/> Get the app</button>
        <button className="rounded-xl border border-slate-200 p-2 md:hidden" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
      </div>
      {menuOpen && <nav className="mx-auto grid w-[min(1160px,calc(100%-40px))] gap-1 pb-4 md:hidden">{nav.map(item => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-orange-50">{item.label}</a>)}<a href="/login" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-orange-50">Sign in</a><a href="/register" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-extrabold text-orange-600 hover:bg-orange-50">Create account</a><button onClick={() => setDownloadOpen(true)} className="mt-2 rounded-full bg-orange-600 px-4 py-3 text-sm font-bold text-white">Get the app</button></nav>}
    </header>

    <section id="home" className="mx-auto w-[min(1200px,calc(100%-32px))] pb-12 pt-8 sm:pb-16 sm:pt-12">
      <div className="overflow-hidden rounded-[24px] sm:rounded-[30px]">
        <img src="/images/sugomate-promotional-banner.png" alt="SUGOMATE — Imong sugo, kami bahala. Food, groceries, Pabili, parcels and errands." className="block h-auto w-full" />
      </div>
      <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center text-center">
        <p className="text-xs font-extrabold uppercase tracking-[.2em] text-orange-600">Your local delivery ecosystem</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#102e57] sm:text-4xl">One community. Many ways we can help.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">From everyday orders to important errands, SUGOMATE connects customers, local businesses, and delivery partners in one convenient place.</p>
        <button onClick={() => setDownloadOpen(true)} className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff8a00] to-[#f0441c] px-7 py-4 text-sm font-extrabold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5"><Download size={17}/> Get the SUGOMATE app <ArrowRight size={16}/></button>
        <span className="mt-3 text-xs font-medium text-slate-400">Android and iPhone download links will be available soon.</span>
      </div>
    </section>

    <section id="services" className="border-y border-slate-100 bg-[#fbfcfe] py-14 sm:py-16">
      <div className="mx-auto w-[min(1080px,calc(100%-40px))]">
        <div className="mb-8 text-center"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-orange-600">What you can do</p><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Everyday needs, all in one place.</h2></div>
        <div className="grid gap-4 md:grid-cols-3">{services.map(item => {const Icon=item.icon;return <article key={item.name} className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_24px_rgba(16,46,87,.04)]"><div className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600"><Icon size={23}/></div><div><h3 className="font-extrabold">{item.name}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p></div></article>})}</div>
      </div>
    </section>

    <section id="ecosystem" className="py-16 sm:py-20">
      <div className="mx-auto w-[min(1080px,calc(100%-40px))]">
        <div className="mx-auto mb-10 max-w-2xl text-center"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-orange-600">The SUGOMATE ecosystem</p><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Good things happen when a community connects.</h2><p className="mt-3 text-sm leading-7 text-slate-500">A shared local marketplace designed to make ordering and delivery simpler for everyone.</p></div>
        <div className="grid gap-5 md:grid-cols-3">{ecosystem.map(item=>{const Icon=item.icon;return <a key={item.title} href={item.href} className="group block rounded-2xl border border-slate-200 p-6 transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"><div className="grid size-12 place-items-center rounded-xl bg-[#102e57] text-white"><Icon size={22}/></div><h3 className="mt-5 text-lg font-black">{item.title}</h3><p className="mt-2 text-sm leading-7 text-slate-500">{item.copy}</p><p className="mt-4 text-sm font-extrabold text-orange-600">Continue <ArrowRight size={15} className="ml-1 inline"/></p></a>})}</div>
      </div>
    </section>

    <section id="coverage" className="bg-[#102e57] py-14 text-white sm:py-16">
      <div className="mx-auto flex w-[min(1080px,calc(100%-40px))] flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
        <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-orange-300">Starting close to home</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Made for our local communities.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">Our initial planned coverage includes Hilongos, Bato, Hindang, Inopacan, and Matalom, subject to merchant and rider availability.</p></div>
        <button onClick={() => setDownloadOpen(true)} className="shrink-0 rounded-full bg-white px-6 py-3.5 text-sm font-extrabold text-[#102e57] transition hover:bg-orange-50">Get app updates <ArrowRight size={16} className="ml-2 inline"/></button>
      </div>
    </section>

    <footer className="border-t border-slate-100 py-8"><div className="mx-auto flex w-[min(1080px,calc(100%-40px))] flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left"><p className="text-xs text-slate-500">© {new Date().getFullYear()} SUGOMATE. All rights reserved.</p><div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs"><span className="font-semibold italic text-[#102e57]">Imong sugo, kami bahala.</span></div></div></footer>

    {downloadOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071d38]/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="download-title" onClick={() => setDownloadOpen(false)}><div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">SUGOMATE mobile app</p><h2 id="download-title" className="mt-2 text-2xl font-black text-[#102e57]">Coming soon!</h2></div><button onClick={() => setDownloadOpen(false)} aria-label="Close" className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X/></button></div><p className="mt-3 text-sm leading-7 text-slate-500">We are preparing SUGOMATE for Android and iPhone. The official download links will be posted here when the apps are published.</p><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl border border-slate-200 p-4"><strong className="text-sm">Android</strong><p className="mt-1 text-xs text-slate-500">Coming soon</p></div><div className="rounded-xl border border-slate-200 p-4"><strong className="text-sm">iPhone</strong><p className="mt-1 text-xs text-slate-500">Coming soon</p></div></div><button onClick={() => setDownloadOpen(false)} className="mt-6 w-full rounded-full bg-orange-600 px-5 py-3 font-bold text-white">Got it</button></div></div>}
  </main>;
}
