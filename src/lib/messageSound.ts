let unlocked = false;
let lastPlayTime = 0;

const COOLDOWN_MS = 400;
const SOUND_URL = '/sounds/message.mp3';

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SOUND_URL);
    audio.volume = 0.3;
  }
  return audio;
}

export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  const a = getAudio();
  a.volume = 0;
  a.play().then(() => { a.pause(); a.volume = 0.3; }).catch(() => {});
}

export function playMessageSound(): void {
  if (!unlocked) return;
  const now = Date.now();
  if (now - lastPlayTime < COOLDOWN_MS) return;
  lastPlayTime = now;

  const a = getAudio();
  a.currentTime = 0;
  a.play().catch(() => {});
}
