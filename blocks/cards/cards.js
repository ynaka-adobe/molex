export default async function decorate(block) {
  [...block.children].forEach((card) => {
    card.classList.add('card');
    const cell = card.firstElementChild;
    if (cell) {
      cell.classList.add('card-body');
      const paras = cell.querySelectorAll(':scope > p');
      const label = paras[0];
      if (label) label.classList.add('card-label');
      const cta = [...paras].find((p) => p.querySelector('a'));
      if (cta) cta.classList.add('card-cta');
    }
  });
}
