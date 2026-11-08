"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main style={{minHeight:"70vh",display:"grid",placeItems:"center",padding:"24px",background:"#fff7ef",fontFamily:"Arial,sans-serif"}}>
          <section style={{maxWidth:480,padding:28,borderRadius:24,background:"#fff",textAlign:"center",border:"1px solid #ffead7"}}>
            <p style={{fontWeight:800,letterSpacing:3,color:"#e65b1b"}}>SUGOMATE</p>
            <h1 style={{color:"#102e57"}}>The page needs to reload</h1>
            <p style={{color:"#64748b",lineHeight:1.6}}>A page update or interrupted connection may have caused this error. Reload the latest version to continue.</p>
            <button onClick={() => window.location.reload()} style={{marginTop:16,padding:"13px 22px",border:0,borderRadius:999,background:"#102e57",color:"#fff",fontWeight:700}}>Reload SUGOMATE</button>
          </section>
        </main>
      </body>
    </html>
  );
}
