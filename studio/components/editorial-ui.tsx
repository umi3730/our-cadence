import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/** Reference-style rolling letters, with one accessible label and no animation library. */
export function RollingLabel({ children }: { children: string }) {
  return <span className="rolling-label"><span className="sr-only">{children}</span><span className="rolling-visual" aria-hidden="true">{[...children].map((letter, i) => <span className="rolling-slot" key={i} style={{ '--delay': `${i * 18}ms` } as CSSProperties}><span className="rolling-letter">{letter === ' ' ? '\u00a0' : letter}</span><span className="rolling-echo">{letter === ' ' ? '\u00a0' : letter}</span></span>)}</span></span>;
}

export function EditorialHeader({ children, studio = false }: { children?: ReactNode; studio?: boolean }) {
  return <header className="editorial-header"><div className="editorial-brand"><Link href="/" className="brand-home" aria-label="Our Cadence 首页"><BrandWordmark /></Link><span>角色的另一种表达</span></div><nav aria-label="主要导航"><Link href="/" aria-current={!studio ? 'page' : undefined}><RollingLabel>INDEX</RollingLabel></Link><Link href="/studio" aria-current={studio ? 'page' : undefined}><RollingLabel>STUDIO</RollingLabel></Link>{children}</nav></header>;
}

/** Display the supplied transparent wordmark with its outer whitespace cropped in CSS. */
export function BrandWordmark() {
  return <span className="brand-wordmark"><img src="/our-cadence-wordmark.png" alt="" width="2103" height="748" /></span>;
}

export function PageDial({ current, total = 3, previous, next, nextDisabled = false, previousDisabled = false }: { current: number; total?: number; previous: () => void; next: () => void; nextDisabled?: boolean; previousDisabled?: boolean }) {
  return <div className="page-dial" aria-label={`第 ${current} / ${total} 页`}><span className="dial-divider" aria-hidden="true" /><span className="dial-current" aria-hidden="true">{String(current).padStart(2, '0')}</span><span className="dial-total" aria-hidden="true">{String(total).padStart(2, '0')}</span><button className="dial-prev" onClick={previous} disabled={previousDisabled} aria-label="上一页"><ArrowLeft size={17} /></button><button className="dial-next" onClick={next} disabled={nextDisabled} aria-label="下一页"><ArrowRight size={17} /></button></div>;
}
