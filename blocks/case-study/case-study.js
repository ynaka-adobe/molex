export default async function decorate(block) {
  const rows = [...block.children];
  const row = rows[0];
  if (!row) return;

  const cells = [...row.children];
  const [imageCell, contentCell] = cells;

  if (imageCell) imageCell.classList.add('case-study-image');
  if (contentCell) contentCell.classList.add('case-study-content');

  // Turn the CTA into an accessible "Watch the Case Study" link with an arrow.
  const cta = contentCell?.querySelector('a');
  if (cta) {
    cta.classList.add('case-study-cta');
  }
}
