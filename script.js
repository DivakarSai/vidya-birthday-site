const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const slideshow = document.getElementById('slideshow');
const backgroundLayer = document.getElementById('background-layer');
const collage = document.getElementById('collage');
const textContainer = document.getElementById('text-container');
const progress = document.getElementById('progress');
const music = document.getElementById('bg-music');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const secretBtn = document.getElementById('secret-btn');
const secretPopup = document.getElementById('secret-popup');
const secretText = document.getElementById('secret-text');
const closeSecret = document.getElementById('close-secret');
const easterEggs = document.getElementById('easter-eggs');

const MIN_CHAPTER_DURATION = 3000;
const MAX_CHAPTER_DURATION = 60000;
const TYPING_SPEED = 60;
const READING_PAUSE = 3000;
const LETTER_TYPING_SPEED = 80;
const LETTER_READING_PAUSE = 8000;
const PROGRESS_INTERVAL = 100;
const MAX_CARDS = 8;

const musicTracks = [
  'audio/until_i_found_you_draft.mp3',
  'audio/i_think_they_call_this_love.mp3',
];

let currentIndex = 0;
let currentDuration = MIN_CHAPTER_DURATION;
let autoAdvanceTimer = null;
let typingTimer = null;
let progressTimer = null;
let progressValue = 0;
let started = false;
let transitioning = false;
let trackIndex = 0;

const positions = [
  { left: '3%', top: '8%', rot: '-6deg' },
  { left: '76%', top: '6%', rot: '5deg' },
  { left: '1%', top: '38%', rot: '4deg' },
  { left: '78%', top: '36%', rot: '-5deg' },
  { left: '20%', top: '18%', rot: '-3deg' },
  { left: '56%', top: '16%', rot: '6deg' },
  { left: '16%', top: '58%', rot: '3deg' },
  { left: '60%', top: '56%', rot: '-4deg' },
];

function isVideo(path) {
  return /\.(mp4|webm|mov|m4v)$/i.test(path);
}

function createMedia(src, autoplay = false) {
  const media = isVideo(src)
    ? document.createElement('video')
    : document.createElement('img');
  media.src = src;
  if (media.tagName === 'VIDEO') {
    media.muted = true;
    media.loop = true;
    media.playsInline = true;
    media.preload = 'metadata';
    if (autoplay) media.autoplay = true;
  } else {
    media.alt = '';
    media.loading = 'lazy';
  }
  return media;
}

function buildBackground(chapter) {
  backgroundLayer.innerHTML = '';
  const first = chapter.images && chapter.images[0];
  if (!first) return;
  const media = createMedia(first, true);
  media.className = 'background-media';
  media.onerror = () => {
    media.style.display = 'none';
    backgroundLayer.style.background =
      'radial-gradient(circle at 50% 40%, #2a1a2e, #0b0b0f 75%)';
  };
  backgroundLayer.appendChild(media);
  requestAnimationFrame(() => media.classList.add('visible'));
}

function buildCollage(chapter) {
  collage.innerHTML = '';
  const images = (chapter.images || []).slice(1, 1 + MAX_CARDS);
  images.forEach((src, index) => {
    const pos = positions[index % positions.length];
    const card = document.createElement('div');
    card.className = 'float-card';
    card.style.left = pos.left;
    card.style.top = pos.top;
    card.style.setProperty('--rot', pos.rot);
    card.style.setProperty('--delay', index * 0.18 + 's');
    card.style.setProperty('--dur', 10 + (index % 4) * 2 + 's');

    const media = createMedia(src);
    media.onerror = () => {
      card.style.display = 'none';
    };
    card.appendChild(media);
    collage.appendChild(card);
  });
}

function syncVideos() {
  collage.querySelectorAll('video').forEach((video) => video.play().catch(() => {}));
  backgroundLayer
    .querySelectorAll('video')
    .forEach((video) => video.play().catch(() => {}));
}

function getChapterDuration(chapter) {
  const text = chapter.text || '';
  const length = text.length;
  const extra = chapter.syncExtra || 0;
  const typingSpeed =
    chapter.typingSpeed ||
    (chapter.isLetter ? LETTER_TYPING_SPEED : TYPING_SPEED);
  if (chapter.isLetter) {
    return (
      length * typingSpeed +
      (chapter.readingPause || LETTER_READING_PAUSE) +
      extra
    );
  }
  return (
    Math.min(
      MAX_CHAPTER_DURATION,
      Math.max(MIN_CHAPTER_DURATION, length * typingSpeed + READING_PAUSE)
    ) + extra
  );
}

function typeText(text, speed = TYPING_SPEED) {
  clearInterval(typingTimer);
  typingTimer = null;
  textContainer.innerHTML = '';
  if (!text) return;
  const p = document.createElement('p');
  p.classList.add('typing');
  textContainer.appendChild(p);
  requestAnimationFrame(() => p.classList.add('visible'));
  let index = 0;
  typingTimer = setInterval(() => {
    p.textContent = text.slice(0, index + 1);
    if (textContainer.classList.contains('letter-mode') && index % 3 === 0) {
      textContainer.scrollTop = textContainer.scrollHeight;
    }
    index += 1;
    if (index >= text.length) {
      clearInterval(typingTimer);
      typingTimer = null;
      p.classList.remove('typing');
      if (textContainer.classList.contains('letter-mode')) {
        textContainer.scrollTop = textContainer.scrollHeight;
      }
    }
  }, speed);
}

function showChapter(index) {
  if (transitioning || !chapters || chapters.length === 0) return;
  transitioning = true;
  currentIndex = (index + chapters.length) % chapters.length;

  collage.classList.add('fade-out');
  textContainer.classList.add('fade-out');
  clearInterval(typingTimer);
  setTimeout(() => {
    const chapter = chapters[currentIndex];
    const isLetter = !!chapter.isLetter;
    currentDuration = getChapterDuration(chapter);
    textContainer.classList.toggle('letter-mode', isLetter);
    textContainer.classList.toggle('final-letter', !!chapter.isFinalLetter);
    textContainer.classList.remove('fade-out');
    const typeSpeed =
      chapter.typingSpeed ||
      (isLetter ? LETTER_TYPING_SPEED : TYPING_SPEED);
    typeText(chapter.text, typeSpeed);
    buildBackground(chapter);
    buildCollage(chapter);
    collage.classList.remove('fade-out');
    syncVideos();
    resetProgress(currentDuration);
    transitioning = false;
    scheduleNext();
  }, 650);
}

function resetProgress(duration) {
  progressValue = 0;
  progress.style.width = '0%';
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    progressValue += (PROGRESS_INTERVAL / duration) * 100;
    if (progressValue >= 100) progressValue = 100;
    progress.style.width = progressValue + '%';
  }, PROGRESS_INTERVAL);
}

function scheduleNext() {
  clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = setTimeout(() => showChapter(currentIndex + 1), currentDuration);
}

function nextChapter() {
  clearTimeout(autoAdvanceTimer);
  clearInterval(typingTimer);
  showChapter(currentIndex + 1);
}

function prevChapter() {
  clearTimeout(autoAdvanceTimer);
  clearInterval(typingTimer);
  showChapter(currentIndex - 1);
}

function createFloatingEmoji() {
  const emoji = document.createElement('span');
  emoji.className = 'floating-emoji';
  emoji.textContent = floatingEmojis[Math.floor(Math.random() * floatingEmojis.length)];
  emoji.style.left = Math.random() * 100 + 'vw';
  emoji.style.bottom = '-2rem';
  emoji.style.fontSize = 0.8 + Math.random() * 1.4 + 'rem';
  emoji.style.animationDuration = 12 + Math.random() * 18 + 's';
  easterEggs.appendChild(emoji);
  setTimeout(() => emoji.remove(), 30000);
}

function startEmojiRain() {
  setInterval(createFloatingEmoji, 1200);
  for (let i = 0; i < 8; i += 1) {
    setTimeout(createFloatingEmoji, i * 300);
  }
}

function openSecret() {
  secretText.textContent = secretMessage;
  secretPopup.classList.remove('hidden');
}

function closeSecretPopup() {
  secretPopup.classList.add('hidden');
}

function playTrack(index) {
  trackIndex = (index + musicTracks.length) % musicTracks.length;
  music.src = musicTracks[trackIndex];
  music.load();
  music.play().catch(() => {});
}

startBtn.addEventListener('click', () => {
  if (started) return;
  started = true;
  startScreen.classList.add('hidden');
  slideshow.classList.remove('hidden');
  showChapter(0);
  startEmojiRain();
  music.volume = 0.7;
  playTrack(0);
});

music.addEventListener('ended', () => playTrack(trackIndex + 1));

prevBtn.addEventListener('click', prevChapter);
nextBtn.addEventListener('click', nextChapter);
secretBtn.addEventListener('click', openSecret);
closeSecret.addEventListener('click', closeSecretPopup);
secretPopup.addEventListener('click', (event) => {
  if (event.target === secretPopup) closeSecretPopup();
});

document.addEventListener('keydown', (event) => {
  if (slideshow.classList.contains('hidden')) return;
  if (event.key === 'ArrowRight') nextChapter();
  if (event.key === 'ArrowLeft') prevChapter();
  if (event.key === 'Escape') closeSecretPopup();
});

if (!chapters || chapters.length === 0) {
  console.warn('No chapters found in content.js');
}
