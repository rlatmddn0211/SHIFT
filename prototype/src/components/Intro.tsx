import { ArrowRight, CalendarCheck, NotebookPen, ScanLine } from 'lucide-react';
import { Button } from './Primitives';

export default function Intro({ onStart }: { onStart: () => void }) {
  return <section className="project-intro" aria-labelledby="project-title">
    <div className="intro-hero">
      <div className="intro-copy">
        <h1 id="project-title">공용차가 바뀌어도<br/>내 방문 업무는 이어집니다.</h1>
        <p>SHIFT는 외근 직원의 일정, 목적지, 방문 메모를 휴대폰과 Pleos Connect에서 이어주는 공용차용 앱입니다.</p>
        <Button onClick={onStart} trailing>QR·PIN 시연 시작</Button>
        <small>예시 데이터로 브라우저에서 체험할 수 있습니다.</small>
      </div>
      <ol className="intro-flow" aria-label="시연 순서">
        <li><ScanLine aria-hidden="true"/><div><strong>차량 QR·PIN 승인</strong><p>차량 QR을 열고 휴대폰에서 6자리 PIN을 입력합니다.</p></div></li>
        <li><CalendarCheck aria-hidden="true"/><div><strong>오늘 방문 업무</strong><p>승인한 직원의 오늘 일정과 변경된 방문지를 확인합니다.</p></div></li>
        <li><NotebookPen aria-hidden="true"/><div><strong>웹에서 저장한 메모를 Pleos에서 확인</strong><p>웹에서 작성한 메모가 차량의 방문 메모 목록에 나타납니다.</p></div></li>
      </ol>
    </div>
    <section className="intro-problem" aria-labelledby="problem-title">
      <h2 id="problem-title">외근 때 반복되는 일을 줄입니다.</h2>
      <dl>
        <div><dt>출발 전 주소 다시 입력</dt><dd>일정과 메일을 오가며 찾던 변경 주소를 Pleos에서 확인하고 내비게이션으로 보냅니다.</dd></div>
        <div><dt>방문 후 메모 옮겨 적기</dt><dd>휴대폰 웹에서 한 번 저장하고, 주차한 차량에서 같은 메모를 엽니다.</dd></div>
        <div><dt>교대 뒤 차량에 남는 업무</dt><dd>휴대폰으로 차량 세션을 종료합니다. 다음 운전자가 로그인하면 자신의 일정과 메모를 봅니다.</dd></div>
      </dl>
      <button className="intro-demo-link" onClick={onStart}>차량과 휴대폰 화면에서 체험하기 <ArrowRight aria-hidden="true"/></button>
    </section>
  </section>;
}
