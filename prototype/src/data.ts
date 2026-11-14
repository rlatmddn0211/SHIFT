export type UserId = 'A' | 'B';
export type VehicleScreen = 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8';
export type PhoneScreen = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7';
export type ScreenId = VehicleScreen | PhoneScreen;

export interface Visit {
  id: string;
  time: string;
  title: string;
  address: string;
  originalAddress?: string;
  contact: string;
  emailTime: string;
  emailSubject: string;
  emailBody: string;
  briefing: string;
}

export interface PersonalNote { id: string; title: string; body: string; updated: string }

interface Employee {
  name: string;
  short: string;
  initials: string;
  role: string;
  email: string;
  seatHeight: number;
  seatPosition: number;
  visits: Visit[];
  notes: PersonalNote[];
}

export const users: Record<UserId, Employee> = {
  A: {
    name: '김민서', short: '민서', initials: '민', role: '영업1팀', email: 'minseo@shift-demo.example',
    seatHeight: 58, seatPosition: 42,
    visits: [
      { id: 'a1', time: '10:30', title: '한빛모빌리티 미팅', address: '경기 성남시 분당구 판교역로 235', originalAddress: '경기 성남시 분당구 판교역로 166', contact: '박지훈 매니저', emailTime: '09:12', emailSubject: '[장소 변경] 오늘 미팅은 판교역로 235에서 진행합니다', emailBody: '민서님, 안녕하세요. 오늘 오전 10시 30분 미팅 장소가 본관에서 별관으로 변경되었습니다. 경기 성남시 분당구 판교역로 235, 3층 회의실로 방문 부탁드립니다. 미팅 시간은 동일합니다. 감사합니다.', briefing: '오전 10시 30분 한빛모빌리티 미팅 장소가 변경됐어요. 판교역로 235, 별관 3층입니다. 미팅 시간은 그대로예요.' },
      { id: 'a2', time: '13:00', title: '성우테크 방문', address: '경기 성남시 분당구 대왕판교로 660', contact: '이서연 팀장', emailTime: '어제 16:30', emailSubject: '내일 방문 일정 확인드립니다', emailBody: '내일 오후 1시 성우테크 사무실에서 뵙겠습니다. 수정 견적서와 제품 소개 자료를 준비해 주세요.', briefing: '오후 1시 성우테크 방문이 있어요. 수정 견적서와 제품 소개 자료를 준비해 주세요.' },
      { id: 'a3', time: '15:20', title: '서진솔루션 미팅', address: '서울 강남구 테헤란로 152', contact: '최도윤 책임', emailTime: '어제 14:10', emailSubject: '서진솔루션 미팅 안건 공유', emailBody: '운영 일정과 연동 범위를 함께 논의할 예정입니다. 오후 3시 20분에 뵙겠습니다.', briefing: '오후 3시 20분 서진솔루션 미팅에서는 운영 일정과 연동 범위를 논의해요.' },
    ] satisfies Visit[],
    notes: [
      { id: 'a-note-1', title: '한빛모빌리티 방문 준비', body: '지난 미팅 후속 사항\n\n• 도입 일정과 담당 부서 확인\n• 수정 견적과 서비스 범위 설명\n• 다음 미팅 일정 협의', updated: '오늘 08:45' },
      { id: 'a-note-2', title: '외근 체크리스트', body: '출발 전\n\n• 방문 일정과 변경 주소 확인\n• 명함·제품 소개 자료 준비\n• 미팅 후 후속 업무 메모', updated: '어제 17:20' },
      { id: 'a-note-3', title: '이번 주 업무 정리', body: '금요일까지 고객사별 수정 견적을 정리하고 다음 주 방문 일정을 확인합니다.', updated: '11월 13일' },
    ] satisfies PersonalNote[],
  },
  B: {
    name: '이준', short: '준', initials: '준', role: '파트너십팀', email: 'jun@shift-demo.example',
    seatHeight: 45, seatPosition: 61,
    visits: [
      { id: 'b1', time: '11:00', title: '다온에너지 업무 협의', address: '서울 서초구 강남대로 311', contact: '정수빈 매니저', emailTime: '08:50', emailSubject: '오늘 다온에너지 미팅 안내', emailBody: '준님, 오전 11시 본사 2층 회의실에서 뵙겠습니다. 다음 분기 협업 계획을 함께 검토할 예정입니다.', briefing: '오전 11시 다온에너지 업무 협의가 있어요. 강남대로 311, 본사 2층 회의실입니다.' },
      { id: 'b2', time: '14:30', title: '새봄랩 파트너 미팅', address: '서울 강남구 영동대로 513', contact: '강지우 대표', emailTime: '어제 15:00', emailSubject: '파트너 미팅 일정 확정', emailBody: '오후 2시 30분에 협업 제안서를 함께 검토하겠습니다.', briefing: '오후 2시 30분 새봄랩에서 협업 제안서를 검토해요.' },
    ] satisfies Visit[],
    notes: [
      { id: 'b-note-1', title: '다온에너지 협업 안건', body: '파트너 미팅 준비\n\n• 다음 분기 공동 과제 논의\n• 기술 검토 일정 확인\n• 각 팀의 담당자 연결', updated: '오늘 08:30' },
      { id: 'b-note-2', title: '파트너 미팅 체크리스트', body: '제안 범위와 후속 일정을 확인하고 미팅 후 협의 내용을 기록합니다.', updated: '어제 18:10' },
    ] satisfies PersonalNote[],
  },
};

export const sampleMemo = '금요일까지 수정 견적을 보내기로 했습니다. 도입 일정은 다음 주 화요일에 다시 확인합니다.';
export const steps = ['차량 인증', '탑승 준비', '방문 업무', '목적지 전달', '방문 후 메모', '세션 종료'];

export const screens: { id: ScreenId; device: 'vehicle' | 'phone'; name: string; description: string; state?: boolean }[] = [
  { id: 'V1', device: 'vehicle', name: '시작·QR 인증', description: '휴대폰으로 차량과 확인 코드를 승인합니다.' },
  { id: 'V2', device: 'vehicle', name: '탑승 준비', description: '업무·좌석·오디오 연결을 준비합니다.' },
  { id: 'V3', device: 'vehicle', name: '업무 홈', description: '오늘 방문과 변경된 업무를 확인합니다.' },
  { id: 'V4', device: 'vehicle', name: '방문 업무 상세', description: '일정과 관련 메일의 근거를 함께 봅니다.' },
  { id: 'V5', device: 'vehicle', name: '목적지 확인·전달', description: '확인한 주소를 내비게이션에 전달합니다.' },
  { id: 'V6', device: 'vehicle', name: '내 노트 조회', description: '선택한 OneNote 내용을 읽습니다.' },
  { id: 'V7', device: 'vehicle', name: '방문 후 음성 메모', description: '주차 후 상담 내용을 기록합니다.' },
  { id: 'V8', device: 'vehicle', name: '좌석 프로필', description: '현재 위치를 저장하고 선호 위치를 적용합니다.' },
  { id: 'V9', device: 'vehicle', name: '개인 세션 종료', description: '휴대폰 승인으로 차량의 개인 접근을 끝냅니다.' },
  { id: 'P1', device: 'phone', name: '시작·Microsoft 로그인', description: '업무 계정으로 SHIFT를 시작합니다.' },
  { id: 'P2', device: 'phone', name: '내 SHIFT 홈', description: '연결한 환경과 현재 차량을 관리합니다.' },
  { id: 'P3', device: 'phone', name: '업무 연결·브리핑 설정', description: '가져올 업무와 안내 범위를 선택합니다.' },
  { id: 'P4', device: 'phone', name: 'OneNote 선택', description: '가져올 노트와 메모 저장 위치를 정합니다.' },
  { id: 'P5', device: 'phone', name: '좌석 프로필 관리', description: '내 착석 환경을 확인합니다.' },
  { id: 'P6', device: 'phone', name: '차량 연결 승인', description: '차량·확인 코드·계정을 확인합니다.' },
  { id: 'P7', device: 'phone', name: '개인 세션 종료 승인', description: 'QR 종료와 원격 종료를 확인합니다.' },
  { id: 'S1', device: 'vehicle', name: 'QR 만료·인증 오류', description: '새 코드를 발급받아 다시 연결합니다.', state: true },
  { id: 'S2', device: 'vehicle', name: '개인 환경 불러오기', description: '현재 인증한 직원의 정보만 불러옵니다.', state: true },
  { id: 'S3', device: 'vehicle', name: '업무 미연결·조회 실패', description: '업무 연결이 없어도 좌석과 세션을 이용합니다.', state: true },
  { id: 'S4', device: 'vehicle', name: '좌석 미지원', description: '지원하지 않는 항목은 적용하지 않습니다.', state: true },
  { id: 'S5', device: 'vehicle', name: '목적지 전달 실패', description: '확인한 주소를 유지하고 재시도합니다.', state: true },
  { id: 'S6', device: 'vehicle', name: '음성 메모 확인', description: '인식된 내용을 확인·수정한 뒤 저장합니다.', state: true },
  { id: 'S7', device: 'vehicle', name: '메모 저장 결과', description: '저장 성공과 실패·재시도를 확인합니다.', state: true },
  { id: 'S8', device: 'vehicle', name: '세션 잠금·교대', description: '개인 정보를 가리고 재인증을 기다립니다.', state: true },
];

export const baseVehicleScreens = screens.filter((s) => s.device === 'vehicle' && !s.state);
export const phoneScreens = screens.filter((s) => s.device === 'phone');
export const stateScreens = screens.filter((s) => s.state);

export function getStep(screen: VehicleScreen): number {
  if (screen === 'V1' || screen === 'S1' || screen === 'S8') return 0;
  if (screen === 'V2' || screen === 'V8' || screen === 'S2' || screen === 'S4') return 1;
  if (screen === 'V3' || screen === 'V4' || screen === 'V6' || screen === 'S3') return 2;
  if (screen === 'V5' || screen === 'S5') return 3;
  if (screen === 'V7' || screen === 'S6' || screen === 'S7') return 4;
  return 5;
}
