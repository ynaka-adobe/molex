export default async function decorate(block) {
  const row = block.querySelector(':scope > div');
  if (!row) return;
  const cells = [...row.children];
  // first column is the brand column (logo, social, address, legal)
  if (cells[0]) cells[0].classList.add('brand');
}
