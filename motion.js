// Pause CSS effects in hidden pages and outside the viewport.
const motionRoot = document.documentElement;
const updatePageMotion = () => motionRoot.classList.toggle('motion-paused', document.hidden);
document.addEventListener('visibilitychange', updatePageMotion);
window.addEventListener('pagehide', () => motionRoot.classList.add('motion-paused'));
window.addEventListener('pageshow', updatePageMotion);
updatePageMotion();

const motionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    entry.target.classList.toggle('motion-paused', !entry.isIntersecting || entry.intersectionRatio === 0);
  }
}, { threshold: 0 });
document.querySelectorAll('.hero-section, .custom-btn, .contact a, .featured-projects__more').forEach((element) => {
  element.classList.add('motion-paused');
  motionObserver.observe(element);
});
