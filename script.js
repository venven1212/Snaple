const messages = [
  { text: "hey, you free later?", type: "msg-in" },
  { text: "yeah what's up 👀", type: "msg-out" },
  { text: "omg send that again 😭", type: "msg-in" },
  { text: "on it lol", type: "msg-out" },
  { text: "wait where are you rn", type: "msg-in" },
];

const phone = document.querySelector('.phone');

function cycleMessages() {
  if (!phone) return;
  const bubbles = phone.querySelectorAll('.msg, .msg-snap');
  const last = bubbles[bubbles.length - 1];
  if (last) {
    last.style.opacity = '0';
    setTimeout(() => last.remove(), 300);
  }
}

setInterval(cycleMessages, 6000);
