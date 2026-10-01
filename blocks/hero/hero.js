/**
 * Hero: background image + centered content (heading, description, CTA).
 * The description collapses until the hero is hovered or focused (see hero.css);
 * use the `static` variant to always show it.
 * @param {Element} block
 */
export default function decorate(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const imgCell = cells.find((cell) => cell.querySelector('picture'));
  const contentCell = cells.find((cell) => cell !== imgCell && cell.textContent.trim());
  if (imgCell) imgCell.classList.add('hero-bg');
  if (!contentCell) return;
  contentCell.classList.add('hero-content');

  const details = [...contentCell.children].filter(
    (el) => !/^H[1-6]$/.test(el.tagName) && !el.classList.contains('button-wrapper'),
  );
  if (!details.length) return;
  const description = document.createElement('div');
  description.className = 'hero-description';
  const inner = document.createElement('div');
  details[0].before(description);
  inner.append(...details);
  description.append(inner);
}
