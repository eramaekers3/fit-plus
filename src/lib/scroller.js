// The page scrolls inside .scroller, not the window.
//
// When the whole document scrolls, iPhone Safari (and home-screen apps) shift position: fixed
// things as the toolbar shrinks and the page bounces, so the tab bar drifted with the scroll.
// Keeping the window still and scrolling one full-screen box instead pins the tab bar and +
// button in place.

export const scroller = () => document.querySelector('.scroller') || document.scrollingElement;

export function scrollToTop(smooth = false) {
  const el = scroller();
  if (el) el.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
}

export function scrollByY(dy) {
  const el = scroller();
  if (el) el.scrollTop += dy;
}
