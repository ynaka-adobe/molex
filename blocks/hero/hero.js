export default function decorate(block) {
  const row = block.firstElementChild;
  if (!row) return;
  const cells = [...row.children];
  const [imgCell, contentCell] = cells;
  if (imgCell) imgCell.classList.add('hero-bg');
  if (contentCell) contentCell.classList.add('hero-content');
}
