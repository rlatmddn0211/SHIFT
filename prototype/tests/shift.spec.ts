import { test, expect, type Locator } from '@playwright/test';

async function approveVehicle(car: Locator, phone: Locator) {
  const pin = car.locator('.v-pin');
  await expect(pin).toHaveText(/^\d{6}$/);
  await car.getByRole('button', { name: '휴대폰 승인 화면 열기' }).click();
  await phone.getByLabel('차량 화면의 PIN').fill(await pin.innerText());
  await phone.getByRole('button', { name: '로그인 승인', exact: true }).click();
  await expect(car.getByRole('heading', { name: '오늘 방문 업무' })).toBeVisible();
}

test('인증 → 좌석 확인 → 업무 근거 → 목적지 → 메모 저장 → 세션 종료', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?view=demo');
  const car = page.locator('.vehicle-app');
  const phone = page.locator('.phone-app');
  await page.getByRole('button', { name: '다시 시작', exact: true }).click();
  await expect(car).toHaveAttribute('data-screen', 'V1');
  await car.getByRole('button', { name: '휴대폰 승인 화면 열기' }).click();
  const pin = phone.getByLabel('차량 화면의 PIN');
  await expect(pin).toHaveValue('');
  await pin.fill('999999');
  await phone.getByRole('button', { name: '로그인 승인', exact: true }).click();
  await expect(phone.getByRole('alert')).toContainText('차량 화면의 PIN을 확인하세요.');
  await approveVehicle(car, phone);
  await page.getByLabel('차량 화면 선택').selectOption('V2');
  await expect(car).toHaveAttribute('data-screen', 'V2');
  await car.locator('.v-seat-card').getByRole('button', { name: '적용', exact: true }).click();
  await car.getByRole('button', { name: '확인하고 적용' }).click();
  await expect(car.locator('.v-applied')).toContainText('적용 완료');
  await car.getByRole('button', { name: '오늘 방문 업무', exact: true }).click();
  await car.getByRole('button', { name: '한빛모빌리티 미팅', exact: true }).click();
  await car.getByRole('button', { name: '메일 원문 확인' }).click();
  await expect(car.locator('.v-mail-body')).toContainText('3층 회의실');
  await car.getByRole('button', { name: '목적지 확인', exact: true }).click();
  await expect(car).toContainText('판교역로 235');
  await car.getByRole('button', { name: '내비로 보내기', exact: true }).click();
  await expect(car).toContainText('목적지를 전달했어요');
  await car.getByRole('button', { name: '방문 후 메모 작성' }).click();
  await car.getByRole('button', { name: '음성 메모 시작' }).click();
  await car.getByRole('button', { name: '녹음 마치기' }).click();
  await car.getByLabel('저장할 메모 내용').fill('금요일까지 수정 견적 전달. 고객사 후속 일정 확인.');
  await car.getByRole('button', { name: '확인하고 저장' }).click();
  await expect(car).toContainText('메모를 저장했어요');
  await expect(phone).toContainText('한빛모빌리티 미팅 · 방문 메모');
  await phone.getByRole('button', { name: /한빛모빌리티 미팅 · 방문 메모/ }).click();
  await expect(page.getByRole('dialog')).toContainText('금요일까지 수정 견적 전달');
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
  await car.getByRole('button', { name: '개인 세션 종료', exact: true }).click();
  await phone.getByRole('button', { name: '확인하고 종료', exact: true }).click();
  await expect(car).toHaveAttribute('data-screen', 'V1');
  await expect(car).not.toContainText('김민서');
  await expect(car).not.toContainText('한빛모빌리티');
  await expect(phone).toContainText('한빛모빌리티 미팅 · 방문 메모');
  expect(errors).toEqual([]);
});

test('A/B 교대 후 이전 업무·노트·미저장 메모를 표시하지 않는다', async ({ page }) => {
  await page.goto('/?view=demo');
  const car = page.locator('.vehicle-app');
  const phone = page.locator('.phone-app');
  await page.getByLabel('차량 화면 선택').selectOption('S6');
  await car.getByLabel('저장할 메모 내용').fill('직원 A에게만 보여야 하는 미저장 메모');
  await page.getByRole('button', { name: '직원 B', exact: true }).click();
  await expect(car).not.toContainText('김민서');
  await expect(car).not.toContainText('직원 A에게만');
  await approveVehicle(car, phone);
  await expect(car).toContainText('이준');
  await expect(car).toContainText('다온에너지');
  await expect(car).not.toContainText('한빛모빌리티');
  await car.getByRole('button', { name: '노트', exact: true }).click();
  await expect(car).toContainText('다온에너지 협업 안건');
  await expect(car).not.toContainText('한빛모빌리티 방문 준비');
  await expect(phone).not.toContainText('김민서');
});

test('목적지·메모 실패 복구, 주행 제한, 잠금 후 개인정보 가림', async ({ page }) => {
  await page.goto('/?view=demo');
  const car = page.locator('.vehicle-app');
  await page.getByLabel('차량 화면 선택').selectOption('S5');
  await expect(car).toContainText('판교역로 235');
  await car.getByRole('button', { name: '다시 보내기', exact: true }).click();
  await expect(car).toContainText('목적지를 전달했어요');
  await page.getByLabel('차량 화면 선택').selectOption('S6');
  await car.getByLabel('저장할 메모 내용').fill('저장 오류가 나도 유지할 중요한 후속 업무');
  await page.getByRole('button', { name: '저장 실패 상황 보기' }).click();
  await expect(car).toContainText('저장하지 못했어요');
  await expect(car).toContainText('유지할 중요한 후속 업무');
  await car.getByRole('button', { name: '다시 저장', exact: true }).click();
  await expect(car).toContainText('메모를 저장했어요');
  await page.getByLabel('차량 화면 선택').selectOption('V8');
  await page.getByRole('button', { name: '정차 중', exact: true }).click();
  await expect(car.getByLabel('좌석 높이', { exact: true })).toBeDisabled();
  await expect(car.getByRole('button', { name: '현재 위치 저장' })).toBeDisabled();
  await page.getByLabel('차량 화면 선택').selectOption('V7');
  await expect(car).toContainText('정차 후 확인하거나 입력');
  await page.getByLabel('차량 화면 선택').selectOption('S8');
  await expect(car).not.toContainText('한빛모빌리티');
  await expect(car).not.toContainText('김민서');
});

test('업무 서비스 연결을 선택하지 않아도 차량 인증과 좌석은 이용 가능', async ({ page }) => {
  await page.goto('/?view=demo');
  const car = page.locator('.vehicle-app');
  const phone = page.locator('.phone-app');
  await page.getByRole('button', { name: '다시 시작', exact: true }).click();
  await page.getByLabel('휴대폰 화면 선택').selectOption('P1');
  await phone.getByRole('button', { name: 'Microsoft 계정으로 시작' }).click();
  await phone.getByRole('switch', { name: 'Outlook 일정·메일' }).click();
  await phone.getByRole('switch', { name: 'OneNote', exact: true }).click();
  await phone.getByRole('button', { name: '설정 완료' }).click();
  await approveVehicle(car, phone);
  await page.getByLabel('차량 화면 선택').selectOption('V2');
  await expect(car).toHaveAttribute('data-screen', 'V2');
  await expect(car).toContainText('업무 연결을 선택하지 않았어요');
  await car.getByRole('button', { name: '좌석', exact: true }).click();
  await expect(car.getByRole('button', { name: '현재 위치 저장' })).toBeEnabled();
  await car.getByRole('button', { name: '업무', exact: true }).click();
  await expect(car).toContainText('업무를 연결하면');
});

test('삭제한 좌석 프로필은 다시 저장하기 전 적용하지 않는다', async ({ page }) => {
  await page.goto('/?view=demo');
  const car = page.locator('.vehicle-app');
  const phone = page.locator('.phone-app');
  await page.getByLabel('휴대폰 화면 선택').selectOption('P5');
  await phone.getByRole('button', { name: '저장된 좌석 설정 삭제' }).click();
  await page.getByLabel('차량 화면 선택').selectOption('V2');
  await car.getByRole('button', { name: '위치 저장', exact: true }).click();
  await expect(car.getByRole('button', { name: '저장한 위치 적용' })).toBeDisabled();
  await car.getByRole('button', { name: '현재 위치 저장' }).click();
  await expect(car.getByRole('button', { name: '저장한 위치 적용' })).toBeEnabled();
});

test('28개 화면 목록과 로고 SVG·PNG 다운로드', async ({ page }) => {
  await page.goto('/?view=demo');
  await page.locator('.studio-nav').getByRole('button', { name: /전체 화면/ }).click();
  await expect(page.locator('.gallery-card')).toHaveCount(28);
  await page.locator('.gallery-filters').getByRole('button', { name: /휴대폰/ }).click();
  await expect(page.locator('.gallery-card')).toHaveCount(9);
  await page.getByRole('button', { name: '로고', exact: true }).click();
  const svgDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'SVG 저장', exact: true }).click();
  expect((await svgDownload).suggestedFilename()).toContain('.svg');
  const pngDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNG 저장', exact: true }).click();
  expect((await pngDownload).suggestedFilename()).toContain('.png');
});

test('웹에서 작성한 방문 메모를 주차 중 같은 운전자의 Pleos에서 확인한다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '외근 때 반복되는 일을 줄입니다.' })).toBeVisible();
  await page.getByRole('button', { name: 'QR·PIN 시연 시작' }).click();
  const car = page.locator('.vehicle-app');
  const phone = page.locator('.phone-app');
  await expect(car.getByRole('heading', { name: '공용차 로그인' })).toBeVisible();
  await expect(phone.getByRole('button', { name: '내 방문 메모', exact: true })).toHaveCount(0);
  await approveVehicle(car, phone);

  await phone.getByRole('button', { name: '내 방문 메모', exact: true }).click();
  await phone.getByRole('button', { name: '메모 작성', exact: true }).click();
  const save = phone.getByRole('button', { name: '메모 저장', exact: true });
  const editor = phone.getByRole('textbox', { name: '메모 내용', exact: true });
  await expect(save).toBeDisabled();
  await editor.fill('   ');
  await expect(save).toBeDisabled();
  await editor.fill('취소할 초안');
  await phone.getByRole('button', { name: '취소', exact: true }).click();
  await phone.getByRole('button', { name: '메모 작성', exact: true }).click();
  await expect(editor).toHaveValue('');
  const memo = '새 제안서 초안을 금요일까지 공유하기.';
  await phone.getByLabel('연결할 방문 (선택)').selectOption({ label: '한빛모빌리티 미팅' });
  await editor.fill(memo);
  await save.click();
  await expect(phone.getByRole('status')).toContainText('메모를 저장했습니다.');
  await expect(phone).toContainText(memo);

  await car.getByRole('button', { name: '방문 메모', exact: true }).click();
  await car.getByRole('button', { name: '한빛모빌리티 미팅 · 방문 메모', exact: true }).click();
  await expect(car.getByRole('heading', { name: '한빛모빌리티 미팅 · 방문 메모' })).toBeVisible();
  await expect(car).toContainText(memo);
  await page.getByRole('button', { name: '정차 중', exact: true }).click();
  await expect(car).not.toContainText(memo);
  await expect(car).toContainText('정차 후 확인하거나 입력');
  await page.getByRole('button', { name: '주행 중', exact: true }).click();

  await page.getByRole('button', { name: '직원 B', exact: true }).click();
  await approveVehicle(car, phone);
  await car.getByRole('button', { name: '방문 메모', exact: true }).click();
  await expect(car).toContainText('저장한 방문 메모가 없습니다.');
  await phone.getByRole('button', { name: '내 방문 메모', exact: true }).click();
  await expect(phone).toContainText('저장한 방문 메모가 없습니다.');
  await expect(phone).not.toContainText(memo);

  await phone.getByRole('button', { name: '메모 작성', exact: true }).click();
  const unlinkedMemo = '일정을 연결하지 않은 직원 B 메모';
  await editor.fill(unlinkedMemo);
  await save.click();
  await expect(phone).toContainText(unlinkedMemo);
  await car.getByRole('button', { name: '방문 메모', exact: true }).click();
  await expect(car).toContainText('일정을 연결하지 않은 직원 B 메모');
  await expect(car).not.toContainText(memo);
});
