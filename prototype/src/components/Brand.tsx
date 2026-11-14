import { Download, ArrowUpRight } from 'lucide-react';
import { Logo, Button } from './Primitives';
import logoUrl from '../assets/shift-logo.svg?url';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Brand({ onNotify }: { onNotify: (text: string) => void }) {
  async function exportLogo(format: 'svg' | 'png', inverse = false) {
    try {
      const response = await fetch(logoUrl);
      if (!response.ok) throw new Error('asset unavailable');
      const text = (await response.text()).replaceAll('#002C5F', inverse ? '#F7F8FA' : '#002C5F');
      const name = 'SHIFT-wordmark-' + (inverse ? 'white' : 'hyundai-blue');
      const blob = new Blob([text], { type: 'image/svg+xml' });
      if (format === 'svg') { downloadBlob(blob, name + '.svg'); return; }
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 2560; canvas.height = 448;
        canvas.getContext('2d')?.drawImage(image, 0, 0, 2560, 448);
        canvas.toBlob((png) => { if (png) downloadBlob(png, name + '.png'); else onNotify('PNG를 만들지 못했어요. SVG로 저장해 주세요.'); }, 'image/png');
        URL.revokeObjectURL(url);
      };
      image.onerror = () => { URL.revokeObjectURL(url); onNotify('로고를 불러오지 못했어요.'); };
      image.src = url;
    } catch { onNotify('로고를 불러오지 못했어요. 다시 시도해 주세요.'); }
  }

  const colors = [{ name: 'Hyundai Blue', hex: '#002C5F', text: '메인 로고 · 휴대폰 주요 동작' }, { name: 'Sky Blue', hex: '#AACAE6', text: '차량 버튼 · 강조 정보' }, { name: 'Vehicle Navy', hex: '#0B1728', text: '확정 Pleos 시안의 바탕' }, { name: 'White', hex: '#FFFFFF', text: '휴대폰 화면 · 명확한 여백' }];
  return <section className="brand-page"><div className="page-intro"><h1>가볍게 연결하고,<br/>빠르게 이어가다.</h1><p>두꺼운 글자와 앞으로 기운 형태, 오른쪽으로 뻗는 스피드 라인.</p></div><div className="brand-logo-board"><span>SHIFT / PRIMARY WORDMARK</span><Logo/><div><a className="button button--primary" href={logoUrl} download="SHIFT-wordmark-hyundai-blue.svg"><Download/><span>SVG 저장</span></a><Button variant="secondary" icon={<Download/>} onClick={() => exportLogo('png')}>PNG 저장</Button></div></div><div className="brand-reverse-board"><Logo inverse/><Button variant="ghost" icon={<Download/>} onClick={() => exportLogo('svg', true)}>흰색 SVG 저장</Button></div><div className="brand-section-heading"><h2>현대자동차 컬러를 기준으로.</h2><a href="https://www.hyundai.com/kr/ko/info/ci/ci-color" target="_blank" rel="noreferrer">공식 전용색상<ArrowUpRight/></a></div><div className="brand-colors">{colors.map((color) => <article key={color.hex}><div className="color-swatch" style={{ background: color.hex }}/><h3>{color.name}</h3><code>{color.hex}</code><p>{color.text}</p></article>)}</div><div className="brand-type"><div><span>한글</span><h3>Noto Sans KR</h3><p>공용차가 바뀌어도, 나의 업무는 그대로.</p></div><div><span>영문 · 숫자</span><h3>Asta Sans</h3><p className="number">10:30 &nbsp; SHIFT &nbsp; 0123456789</p></div></div></section>;
}
