// ────────────────────────────────────────
// Floating hearts background
// ────────────────────────────────────────
const heartsBg = document.getElementById("heartsBg");
const heartEmojis = ["💕", "💗", "💖", "🩷", "♥", "💘", "✨", "🌸"];

for (let i = 0; i < 25; i++) {
  const h = document.createElement("span");
  h.className = "heart-float";
  h.textContent = heartEmojis[i % heartEmojis.length];
  h.style.left = Math.random() * 100 + "%";
  h.style.animationDuration = 6 + Math.random() * 8 + "s";
  h.style.animationDelay = Math.random() * 10 + "s";
  h.style.fontSize = 0.9 + Math.random() * 0.8 + "rem";
  heartsBg.appendChild(h);
}

// ────────────────────────────────────────
// DOM references
// ────────────────────────────────────────
const btnNo = document.getElementById("btnNo");
const btnYes = document.getElementById("btnYes");
const questionView = document.getElementById("questionView");
const yesScreen = document.getElementById("yesScreen");

// ────────────────────────────────────────
// Runaway No button
// ────────────────────────────────────────
const noMessages = [
  "No",
  "Are you sure? 🥺",
  "Really?? 😢",
  "Think again! 💔",
  "Please? 🥹",
  "Pretty please?",
  "I'll be sad 😭",
  "Last chance! 💕",
  "You're breaking my heart!",
  "Noooo 😿",
  "Reconsider? 🌹",
];
let noCount = 0;
let isMoving = false;
const FLEE_DISTANCE = 60; // px — how close cursor can get before it bolts

function runAway() {
  const card = btnNo.closest(".card");
  const cardRect = card.getBoundingClientRect();
  const btnW = btnNo.offsetWidth;
  const btnH = btnNo.offsetHeight;

  // Safe area within the card
  const pad = 15;
  const safeW = cardRect.width - btnW - pad * 2;
  const safeH = cardRect.height - btnH - pad * 2;

  // Random new position within the card
  const newLeft = pad + Math.random() * safeW;
  const newTop = pad + Math.random() * safeH;

  btnNo.style.position = "absolute";
  btnNo.style.left = newLeft + "px";
  btnNo.style.top = newTop + "px";
  btnNo.style.zIndex = "5";

  noCount++;
  btnNo.textContent = noMessages[Math.min(noCount, noMessages.length - 1)];

  // Make Yes button grow slightly each time
  const scale = 1 + noCount * 0.06;
  btnYes.style.transform = `scale(${Math.min(scale, 1.5)})`;
}

// Desktop: track mouse globally so even if the button teleports
// under the cursor it immediately flees again
document.addEventListener("mousemove", (e) => {
  if (isMoving) return;

  const rect = btnNo.getBoundingClientRect();
  const btnCX = rect.left + rect.width / 2;
  const btnCY = rect.top + rect.height / 2;
  const dist = Math.hypot(e.clientX - btnCX, e.clientY - btnCY);

  // Trigger when cursor is within flee distance OR inside the button
  if (dist < FLEE_DISTANCE + Math.max(rect.width, rect.height) / 2) {
    isMoving = true;
    runAway();
    // Small cooldown so it doesn't jitter endlessly
    setTimeout(() => {
      isMoving = false;
    }, 120);
  }
});

// Block any actual clicks on No just in case
btnNo.addEventListener("click", (e) => {
  e.preventDefault();
  runAway();
});

// Mobile: touchstart triggers runaway
btnNo.addEventListener("touchstart", (e) => {
  e.preventDefault();
  runAway();
});

// ────────────────────────────────────────
// Yes button → success screen + confetti
// ────────────────────────────────────────
btnYes.addEventListener("click", () => {
  questionView.style.display = "none";
  yesScreen.style.display = "flex";
  launchConfetti();
});

// ────────────────────────────────────────
// CONFIG — UPDATE THESE
// ────────────────────────────────────────
const WORKER_URL = "https://google-calendar-invite.jason-invite.workers.dev";
// ↑ Replace with your deployed Cloudflare Worker URL

// ────────────────────────────────────────
// Date picker flow
// ────────────────────────────────────────
const btnPickDate = document.getElementById("btnPickDate");
const pickerScreen = document.getElementById("pickerScreen");
const dateInput = document.getElementById("dateInput");
const timeInput = document.getElementById("timeInput");
const btnConfirm = document.getElementById("btnConfirm");
const statusMsg = document.getElementById("statusMsg");
const doneScreen = document.getElementById("doneScreen");

// Set min date to today
const today = new Date().toISOString().split("T")[0];
dateInput.setAttribute("min", today);

btnPickDate.addEventListener("click", () => {
  yesScreen.style.display = "none";
  pickerScreen.style.display = "flex";
});

btnConfirm.addEventListener("click", async () => {
  const date = dateInput.value;
  const time = timeInput.value;

  if (!date || !time) {
    statusMsg.textContent = "Please pick both a date and time! 😊";
    statusMsg.className = "status-msg error";
    return;
  }

  btnConfirm.disabled = true;
  btnConfirm.textContent = "Sending... 💌";
  statusMsg.textContent = "";

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, time }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to send");
    }

    pickerScreen.style.display = "none";
    doneScreen.style.display = "flex";
    launchConfetti();
  } catch (err) {
    console.error("Send error:", err);
    statusMsg.textContent = "Oops, something went wrong. Try again! 😅";
    statusMsg.className = "status-msg error";
    btnConfirm.disabled = false;
    btnConfirm.textContent = "Confirm & Send Invite 💌";
  }
});

// ────────────────────────────────────────
// Confetti
// ────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById("confetti");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const colors = [
    "#e8567f", "#f9d1dc", "#e8a87c", "#c43a60",
    "#ff6b9d", "#ffd1e8", "#ffb6c1", "#ff85a1", "#f4978e",
  ];

  for (let i = 0; i < 150; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: 2 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 3,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 8,
      shape: Math.random() > 0.4 ? "rect" : "heart",
    });
  }

  let frame = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    pieces.forEach((p) => {
      p.y += p.vy;
      p.x += p.vx;
      p.rot += p.rotV;
      p.vy += 0.04;
      if (p.y < canvas.height + 50) alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.85;

      if (p.shape === "heart") {
        ctx.font = p.w * 2 + "px serif";
        ctx.fillText("♥", 0, 0);
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    });

    frame++;
    if (alive && frame < 300) requestAnimationFrame(draw);
  }

  draw();
}

// Resize confetti canvas on window resize
window.addEventListener("resize", () => {
  const c = document.getElementById("confetti");
  c.width = window.innerWidth;
  c.height = window.innerHeight;
});
