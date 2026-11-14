import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, X } from 'lucide-react';

export function Logo({ inverse = false, className = '' }: { inverse?: boolean; className?: string }) {
  return <svg className={'shift-logo ' + className} viewBox="16 30 640 112" fill={inverse ? '#AACAE6' : '#002C5F'} role="img" aria-label="SHIFT"><g transform="translate(44 35) skewX(-12)"><path d="M18 0H90V24H30V39H68L88 58V82L70 100H0V76H58V61H22L2 43V18Z"/><path d="M108 0H134V37H170V0H196V100H170V63H134V100H108Z"/><path d="M218 0H244V100H218Z"/><path d="M266 0H352V24H292V42H338V66H292V100H266Z"/><path d="M374 0H474V24H437V100H411V24H374Z"/><path d="M486 0H535L525 10H484Z"/><path d="M484 16H574L562 26H482Z"/><path d="M482 32H544L533 42H480Z"/><path d="M585 16H605L593 26H583Z"/></g></svg>;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost'; icon?: ReactNode; trailing?: boolean }
export function Button({ children, variant = 'primary', icon, trailing, className = '', ...props }: ButtonProps) {
  return <button className={'button button--' + variant + ' ' + className} {...props}>{icon}<span>{children}</span>{trailing ? <ArrowRight aria-hidden="true"/> : null}</button>;
}

export function IconButton({ label, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" className={'icon-button ' + className} aria-label={label} title={label} {...props}>{children}</button>;
}

export function Back({ onClick, label = '뒤로' }: { onClick: () => void; label?: string }) { return <button className="back-button" onClick={onClick}><ArrowLeft aria-hidden="true"/>{label}</button>; }

export function Row({ icon, title, detail, onClick, trailing, className = '' }: { icon?: ReactNode; title: ReactNode; detail?: ReactNode; onClick?: () => void; trailing?: ReactNode; className?: string }) {
  const content = <>{icon ? <span className="row-icon">{icon}</span> : null}<span className="row-copy"><strong>{title}</strong>{detail ? <span>{detail}</span> : null}</span>{trailing ?? (onClick ? <ChevronRight className="row-chevron" aria-hidden="true"/> : null)}</>;
  return onClick ? <button className={'list-row ' + className} onClick={onClick}>{content}</button> : <div className={'list-row ' + className}>{content}</div>;
}

export function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: () => void; description?: string }) {
  return <div className="toggle-row"><span><strong>{label}</strong>{description ? <small>{description}</small> : null}</span><button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className={'toggle ' + (checked ? 'is-on' : '')}><span/></button></div>;
}

export function Notice({ children, type = 'info' }: { children: ReactNode; type?: 'info' | 'error' | 'success' }) { return <div className={'notice notice--' + type} role={type === 'error' ? 'alert' : 'status'}>{type === 'success' ? <Check aria-hidden="true"/> : null}<span>{children}</span></div>; }

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>('button, input, textarea, select, [tabindex="0"]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handle);
    return () => { window.removeEventListener('keydown', handle); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="modal" onClick={(e) => e.stopPropagation()}><div className="modal-heading"><h2>{title}</h2><IconButton label="닫기" onClick={onClose}><X/></IconButton></div>{children}</div></div>;
}

export function ScaledCanvas({ width, height, children, className = '' }: { width: number; height: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width));
    observer.observe(target);
    return () => observer.disconnect();
  }, [width]);
  return <div ref={ref} className={'scaled-canvas ' + className} style={{ aspectRatio: width + ' / ' + height, '--canvas-scale': scale } as CSSProperties}><div className="scaled-content" style={{ width, height, transform: 'scale(' + scale + ')' }}>{children}</div></div>;
}
