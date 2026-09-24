import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  const rows = [...block.children];
  let heading = 'Common Searches';

  // Separate the heading row (no picture) from card rows.
  const cardRows = [];
  rows.forEach((row) => {
    if (row.querySelector('picture')) {
      cardRows.push(row);
    } else {
      const h = row.querySelector('h1,h2,h3,h4,h5,h6');
      if (h) heading = h.textContent.trim();
    }
  });

  // Build the intro panel (heading + prev/next controls).
  const intro = document.createElement('div');
  intro.className = 'common-searches-intro';
  const h2 = document.createElement('h2');
  h2.textContent = heading;
  const controls = document.createElement('div');
  controls.className = 'common-searches-controls';
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'common-searches-arrow common-searches-prev';
  prev.setAttribute('aria-label', 'Previous');
  prev.innerHTML = '<span>&#8592;</span>';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'common-searches-arrow common-searches-next';
  next.setAttribute('aria-label', 'Next');
  next.innerHTML = '<span>&#8594;</span>';
  controls.append(prev, next);
  intro.append(h2, controls);

  // Build the scrolling track of cards.
  const track = document.createElement('div');
  track.className = 'common-searches-track';
  const ul = document.createElement('ul');
  ul.className = 'common-searches-slides';

  cardRows.forEach((row) => {
    const cells = [...row.children];
    const li = document.createElement('li');
    li.className = 'common-searches-card';

    const imgCell = cells.find((c) => c.querySelector('picture'));
    const titleCell = cells.find((c) => c.querySelector('h1,h2,h3,h4,h5,h6'));
    const linkCell = cells.find((c) => c.querySelector('a'));

    const link = linkCell ? linkCell.querySelector('a') : null;
    const href = link ? link.getAttribute('href') : '#';

    const anchor = document.createElement('a');
    anchor.className = 'common-searches-card-link';
    anchor.href = href;

    const title = document.createElement('h3');
    title.className = 'common-searches-card-title';
    if (titleCell) title.textContent = titleCell.textContent.trim();

    const imageWrap = document.createElement('div');
    imageWrap.className = 'common-searches-card-image';
    if (imgCell) imageWrap.append(...imgCell.childNodes);

    const cta = document.createElement('span');
    cta.className = 'common-searches-card-cta';
    cta.innerHTML = `${link ? link.textContent.trim() : ''} <span class="common-searches-card-arrow">&#8594;</span>`;

    anchor.append(title, imageWrap, cta);
    li.append(anchor);
    ul.append(li);
  });

  track.append(ul);

  // Optimize images.
  ul.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [{ width: '400' }]),
    );
  });

  // Pagination dots (one per card).
  const dots = document.createElement('div');
  dots.className = 'common-searches-dots';
  const cards = [...ul.children];
  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'common-searches-dot';
    dot.setAttribute('aria-label', `Go to item ${i + 1}`);
    if (i === 0) dot.classList.add('is-active');
    dot.addEventListener('click', () => {
      cards[i].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    });
    dots.append(dot);
  });

  const scrollByCard = (dir) => {
    const card = ul.querySelector('.common-searches-card');
    const amount = card ? card.getBoundingClientRect().width + 20 : 300;
    track.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };
  prev.addEventListener('click', () => scrollByCard(-1));
  next.addEventListener('click', () => scrollByCard(1));

  // Keep dots in sync with scroll position.
  track.addEventListener('scroll', () => {
    const cardW = (cards[0] ? cards[0].getBoundingClientRect().width : 0) + 20;
    if (!cardW) return;
    const idx = Math.round(track.scrollLeft / cardW);
    dots.querySelectorAll('.common-searches-dot').forEach((d, i) => {
      d.classList.toggle('is-active', i === idx);
    });
  });

  block.replaceChildren(intro, track, dots);
}
