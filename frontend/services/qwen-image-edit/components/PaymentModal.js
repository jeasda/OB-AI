const PACKAGES = [
  { credits: 100, price: '฿99' },
  { credits: 300, price: '฿259' },
  { credits: 500, price: '฿399' },
  { credits: 1000, price: '฿699' }
]

export function createPaymentModal({ onClose, onPurchasePackage, onPaySingle }) {
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/80 p-4'
  overlay.setAttribute('aria-hidden', 'true')

  const modal = document.createElement('div')
  modal.className = 'max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl'

  modal.innerHTML = `
    <div class="flex items-start justify-between">
      <div>
        <div class="text-xs uppercase tracking-[0.2em] text-emerald-300">โหมดทดสอบ</div>
        <h2 class="text-xl font-semibold">เลือกวิธีชำระเงิน</h2>
        <p class="text-sm text-slate-400">ระบบยังเป็นแบบจำลอง ไม่มีการตัดเงินจริง</p>
      </div>
      <button id="close-modal" class="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">ปิด</button>
    </div>
    <div class="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div class="space-y-4">
        <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm">
          <div class="text-xs uppercase tracking-[0.2em] text-slate-400">สรุปบริการ</div>
          <div class="mt-2 text-base font-semibold">Qwen Image Edit</div>
          <div class="text-sm text-slate-400">1 ภาพ</div>
          <div id="summary-credits" class="mt-2 text-sm"></div>
        </div>

        <div class="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div class="text-sm font-semibold">ซื้อเครดิต (คุ้มกว่า)</div>
          <div class="mt-3 grid gap-2">
            ${PACKAGES.map((pkg) => `
              <button class="package-btn flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-left text-sm" data-credits="${pkg.credits}">
                <div>
                  <div class="font-semibold">${pkg.credits} เครดิต</div>
                  <div class="text-xs text-slate-300">ใช้ได้หลายครั้ง</div>
                </div>
                <div class="text-xs text-emerald-200">${pkg.price}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div class="text-sm font-semibold">จ่ายเฉพาะภาพนี้</div>
          <p class="text-xs text-slate-400">ราคาสูงกว่านิดหน่อย แต่จบงานเร็ว</p>
          <button id="pay-single" class="mt-3 w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-100">จ่ายสำหรับภาพนี้ (โหมดทดสอบ)</button>
        </div>
      </div>

      <div class="space-y-4">
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div class="text-sm font-semibold">วิธีชำระเงิน</div>
          <div class="mt-3 grid gap-3">
            <div class="rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-400">QR PromptPay (ตัวอย่าง)</div>
            <div class="rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-400">บัตรเครดิต/เดบิต (ตัวอย่าง)</div>
          </div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
          <div class="font-semibold">สมัครสมาชิกเพื่อรับเครดิตสะสม</div>
          <p class="text-xs text-slate-400">ยังไม่พร้อมสมัครก็ข้ามได้</p>
          <div class="mt-3 flex gap-2">
            <button class="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200">สมัครสมาชิก</button>
            <button id="skip-signup" class="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200">ข้าม</button>
          </div>
        </div>
      </div>
    </div>
  `

  overlay.appendChild(modal)

  const closeBtn = modal.querySelector('#close-modal')
  const summaryCredits = modal.querySelector('#summary-credits')
  const paySingle = modal.querySelector('#pay-single')
  const skipSignup = modal.querySelector('#skip-signup')
  const packageButtons = Array.from(modal.querySelectorAll('.package-btn'))

  function setSummary(creditsNeeded) {
    summaryCredits.textContent = `ต้องใช้ ${creditsNeeded} เครดิต`
  }

  closeBtn.addEventListener('click', () => onClose())
  skipSignup.addEventListener('click', () => onClose())
  paySingle.addEventListener('click', () => onPaySingle())

  for (const button of packageButtons) {
    button.addEventListener('click', () => {
      const credits = Number(button.dataset.credits || 0)
      onPurchasePackage(credits)
    })
  }

  return {
    el: overlay,
    open(creditsNeeded) {
      setSummary(creditsNeeded)
      overlay.classList.remove('hidden')
      overlay.classList.add('flex')
      overlay.setAttribute('aria-hidden', 'false')
    },
    close() {
      overlay.classList.add('hidden')
      overlay.classList.remove('flex')
      overlay.setAttribute('aria-hidden', 'true')
    }
  }
}
