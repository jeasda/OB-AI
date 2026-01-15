const PACKAGES = [
  { credits: 100, price: '฿99' },
  { credits: 300, price: '฿259' },
  { credits: 500, price: '฿399' },
  { credits: 1000, price: '฿699' }
]

export function createPaymentModal({ onClose, onPurchasePackage, onPaySingle }) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.setAttribute('aria-hidden', 'true')

  const modal = document.createElement('div')
  modal.className = 'modal'

  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
      <div>
        <div class="panel-title">โหมดทดสอบ</div>
        <h2>เลือกวิธีชำระเงิน</h2>
        <p class="muted">ระบบยังเป็นแบบจำลอง ไม่มีการตัดเงินจริง</p>
      </div>
      <button id="close-modal" class="btn btn-secondary">ปิด</button>
    </div>
    <div class="modal-grid">
      <div class="panel-section">
        <div class="card">
          <div class="panel-title">สรุปบริการ</div>
          <div style="font-weight:600;">Qwen Image Edit</div>
          <div class="muted">1 ภาพ</div>
          <div id="summary-credits" style="margin-top:8px;"></div>
        </div>

        <div class="card">
          <div style="font-weight:600;">ซื้อเครดิต (คุ้มกว่า)</div>
          <div class="panel-section" style="gap:8px; margin-top:12px;">
            ${PACKAGES.map((pkg) => `
              <button class="btn btn-secondary package-btn" data-credits="${pkg.credits}">
                <span>${pkg.credits} เครดิต</span>
                <span class="muted">${pkg.price}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div style="font-weight:600;">จ่ายเฉพาะภาพนี้</div>
          <p class="muted">ราคาสูงกว่านิดหน่อย แต่จบงานเร็ว</p>
          <button id="pay-single" class="btn btn-secondary" style="margin-top:8px;">จ่ายสำหรับภาพนี้ (โหมดทดสอบ)</button>
        </div>
      </div>

      <div class="panel-section">
        <div class="card">
          <div style="font-weight:600;">วิธีชำระเงิน</div>
          <div class="panel-section" style="gap:8px; margin-top:12px;">
            <div class="card muted">QR PromptPay (ตัวอย่าง)</div>
            <div class="card muted">บัตรเครดิต/เดบิต (ตัวอย่าง)</div>
          </div>
        </div>
        <div class="card">
          <div style="font-weight:600;">สมัครสมาชิกเพื่อรับเครดิตสะสม</div>
          <p class="muted">ยังไม่พร้อมสมัครก็ข้ามได้</p>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="btn btn-secondary">สมัครสมาชิก</button>
            <button id="skip-signup" class="btn btn-secondary">ข้าม</button>
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
      overlay.classList.add('modal-open')
      overlay.setAttribute('aria-hidden', 'false')
    },
    close() {
      overlay.classList.remove('modal-open')
      overlay.setAttribute('aria-hidden', 'true')
    }
  }
}
