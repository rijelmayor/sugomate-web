export function BrandMark({ size = 56 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="SUGOMATE bird and road symbol" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="sm-orange" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffc21a"/><stop offset=".48" stopColor="#ff7100"/><stop offset="1" stopColor="#e92f19"/></linearGradient><linearGradient id="sm-red" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff8b00"/><stop offset="1" stopColor="#ed2e1b"/></linearGradient></defs>
    <path d="M18 29 C38 7 69 5 92 17 C80 17 68 22 59 31 C78 27 91 32 102 43 C87 40 76 43 68 51 C59 58 56 70 48 81 C39 94 22 104 7 108 C22 94 29 80 29 68 C29 53 19 47 18 29Z" fill="url(#sm-orange)"/>
    <path d="M20 28 C38 10 60 8 78 14 C63 18 53 27 48 36 C63 32 76 34 87 42 C72 40 59 47 51 60 C44 71 41 87 24 98 C34 81 35 68 29 57 C23 48 18 40 20 28Z" fill="url(#sm-red)" opacity=".95"/>
    <path d="M60 23 C70 17 82 17 94 22 L108 30 L90 34 L78 31Z" fill="#ffbf17"/><path d="M92 33 L108 30 L99 44 L87 43Z" fill="#ed3b17"/>
    <path d="M76 48 C66 51 60 61 54 73 C47 87 31 99 13 107 C31 91 39 76 40 63 C41 51 32 42 27 37 C41 42 48 51 50 60 C58 49 66 45 76 48Z" fill="#0d2f59"/>
    <path d="M21 58 C30 57 37 61 42 67" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" strokeDasharray="8 8"/>
    <path d="M8 72 H29 M2 84 H22" stroke="url(#sm-orange)" strokeWidth="6" strokeLinecap="round"/>
    <path d="M78 26 Q84 23 90 26" stroke="#0d2f59" strokeWidth="3" strokeLinecap="round" fill="none"/><circle cx="88" cy="28" r="2.5" fill="#0d2f59"/>
  </svg>;
}
export function BrandLockup({ light = false }: { light?: boolean }) {
  const color = light ? "#ffffff" : "#0d2f59";
  return <div style={{display:"flex",alignItems:"center",gap:8}}><BrandMark/><div style={{lineHeight:1}}><div style={{fontSize:25,fontWeight:950,letterSpacing:"-1.6px",color}}><span>SUGO</span><span style={{background:"linear-gradient(110deg,#ff8100,#ec3518)",WebkitBackgroundClip:"text",color:"transparent"}}>MATE</span></div><div style={{fontSize:10,fontWeight:700,fontStyle:"italic",color,marginTop:5}}>Imong sugo, among ihatod.</div></div></div>;
}
