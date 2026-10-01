import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
const HOVER_OPEN_DELAY = 120;
const HOVER_CLOSE_DELAY = 250;
const MAX_ROWS = 12;
let uid = 0;
const nextId = (prefix) => {
  uid += 1;
  return `${prefix}-${uid}`;
};

/**
 * Toggles the mobile nav (hamburger)
 * @param {Element} nav The nav element
 * @param {Boolean} [forceExpanded] Force the expanded state
 */
function toggleMenu(nav, forceExpanded = null) {
  const expanded = forceExpanded !== null ? forceExpanded : nav.getAttribute('aria-expanded') !== 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded && !isDesktop.matches) ? 'hidden' : '';
  nav.setAttribute('aria-expanded', expanded);
  button.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');
  button.setAttribute('aria-expanded', expanded);
}

/** Authored content of a list item, excluding nested lists (unwraps a single paragraph). */
function ownContent(li) {
  const nodes = [...li.childNodes].filter((n) => !(n.nodeType === 1 && n.matches('ul, ol')));
  const els = nodes.filter((n) => n.nodeType === 1 || n.textContent.trim());
  if (els.length === 1 && els[0].tagName === 'P') return [...els[0].childNodes];
  return nodes;
}

const subList = (li) => li.querySelector(':scope > ul, :scope > ol');

/** Moves an authored link out of its formatting, dropping button decoration. */
function cleanLink(a) {
  a.removeAttribute('class');
  a.removeAttribute('title');
  return a;
}

/** Builds a plain menu entry (link, or text when no link was authored). */
function buildEntry(li) {
  const content = ownContent(li);
  const holder = document.createElement('div');
  holder.append(...content);
  const a = holder.querySelector('a');
  if (a) return cleanLink(a);
  const span = document.createElement('span');
  span.textContent = holder.textContent.trim();
  return span;
}

/** Normalised path used to pair featured links with the drill-down of the same page. */
const pathKey = (a) => (a?.href ? new URL(a.href, window.location).pathname.replace(/\/$/, '') : '');

/**
 * Builds the items of a group list. At the top level, an item with a nested list becomes
 * a drill-down ("›") that opens its own view; deeper nested lists render as indented links.
 */
function buildItems(list, depth, ctx) {
  const ul = document.createElement('ul');
  ul.className = depth === 0 ? 'nav-group-list' : 'nav-sublist';
  [...list.children].forEach((li) => {
    const item = document.createElement('li');
    const sub = subList(li);
    const featured = !sub && li.querySelector(':scope > em, :scope > p > em');
    if (sub && depth === 0) {
      // eslint-disable-next-line no-use-before-define
      item.append(...buildDrill(li, sub, ctx));
      item.className = 'nav-drill-item';
    } else {
      item.append(buildEntry(li));
      if (sub) item.append(buildItems(sub, depth + 1, ctx));
      if (featured) {
        item.className = 'nav-featured';
        ctx.featured.push(item);
      }
    }
    ul.append(item);
  });
  return ul;
}

/** Builds groups (optional heading + list) from a list whose items may contain nested lists. */
function buildGroups(list, depth, ctx) {
  const groups = [];
  let loose;
  [...list.children].forEach((li) => {
    const sub = subList(li);
    if (sub) {
      loose = null;
      const group = document.createElement('div');
      group.className = 'nav-group';
      const heading = document.createElement('p');
      heading.className = 'nav-group-heading';
      const entry = buildEntry(li);
      heading.append(entry.tagName === 'A' ? entry : entry.textContent);
      if (heading.textContent.trim()) group.append(heading);
      group.append(buildItems(sub, depth, ctx));
      groups.push(group);
    } else {
      if (!loose) {
        loose = document.createElement('ul');
        const group = document.createElement('div');
        group.className = 'nav-group';
        group.append(loose);
        groups.push(group);
      }
      loose.append(li);
    }
  });
  groups.forEach((group) => {
    const raw = group.querySelector(':scope > ul:not([class])');
    if (raw) raw.replaceWith(buildItems(raw, depth, ctx));
  });
  return groups;
}

/**
 * Packs groups into grid columns: short groups stack in one column, long lists span
 * several columns and flow into CSS columns. A single group spreads across the panel.
 */
function arrangeGroups(groups, tracks) {
  const rows = (g) => g.querySelectorAll('li').length
    + (g.querySelector('.nav-group-heading') ? 1 : 0);
  const columns = [];
  if (groups.length === 1) {
    const span = rows(groups[0]) > 20 ? tracks : Math.min(3, tracks);
    columns.push({ groups, span });
  } else {
    let current;
    let used = 0;
    groups.forEach((g, i) => {
      const r = rows(g);
      const after = groups.length - i - 1;
      if (r > MAX_ROWS) {
        const room = tracks - used - (after ? 1 : 0);
        const span = Math.max(1, Math.min(Math.ceil(r / MAX_ROWS), room));
        columns.push({ groups: [g], span });
        used += span;
        current = null;
      } else if (current && current.rows + r <= MAX_ROWS) {
        current.groups.push(g);
        current.rows += r;
      } else {
        current = { groups: [g], rows: r, span: 1 };
        columns.push(current);
        used += 1;
      }
    });
  }
  return columns.map(({ groups: gs, span }) => {
    const col = document.createElement('div');
    col.className = 'nav-col';
    col.style.setProperty('--span', span);
    gs.forEach((g) => g.querySelector('.nav-group-list')?.style.setProperty('--cols', span));
    col.append(...gs);
    return col;
  });
}

/** Builds a drill-down trigger and its view (title, back button and grouped links). */
function buildDrill(li, sub, ctx) {
  const entry = buildEntry(li);
  const id = nextId('nav-drill');
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'nav-drill-trigger';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', id);
  trigger.textContent = entry.textContent.trim();
  trigger.dataset.path = pathKey(entry);

  const view = document.createElement('div');
  view.className = 'nav-drill';
  view.id = id;
  view.hidden = true;
  view.setAttribute('role', 'group');
  view.setAttribute('aria-label', trigger.textContent);

  const head = document.createElement('div');
  head.className = 'nav-drill-head';
  const title = document.createElement('p');
  title.className = 'nav-drill-title';
  title.textContent = trigger.textContent;
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'nav-back';
  back.textContent = `Back to ${ctx.label}`;
  head.append(title, back);
  view.append(head, ...arrangeGroups(buildGroups(sub, 1, ctx), 3));
  ctx.drills.push({ trigger, view, back });
  return [trigger, view];
}

/**
 * Decorates the main menu (row 2) as a mega menu: each top-level item with a nested list
 * opens a full-width panel of link groups. Desktop opens on hover or click; mobile uses
 * an accordion. Returns a function that closes any open menu.
 * @param {Element} navSections The sections element
 * @returns {{ closeInnermost: Function, closeAll: Function }}
 */
function decorateSections(navSections) {
  const source = navSections.querySelector('.default-content-wrapper > ul, ul');
  const menu = document.createElement('ul');
  menu.className = 'nav-menu';
  const items = [];

  [...(source?.children || [])].forEach((li) => {
    const item = document.createElement('li');
    item.className = 'nav-menu-item';
    const sub = subList(li);
    const entry = buildEntry(li);
    if (!sub) {
      entry.classList.add('nav-menu-link');
      if (entry.tagName === 'A') {
        const span = document.createElement('span');
        span.append(...entry.childNodes);
        entry.append(span);
      }
      item.append(entry);
      menu.append(item);
      return;
    }
    const label = entry.textContent.trim();
    const panelId = nextId('nav-panel');
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'nav-menu-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panelId);
    const text = document.createElement('span');
    text.textContent = label;
    trigger.append(text);

    const panel = document.createElement('div');
    panel.className = 'nav-panel';
    panel.id = panelId;
    panel.hidden = true;
    const ctx = { label, drills: [], featured: [] };
    const groups = buildGroups(sub, 0, ctx);
    const content = document.createElement('div');
    content.className = 'nav-panel-content';
    const columns = arrangeGroups(groups, 4);
    content.append(...columns);
    content.style.setProperty('--tracks', groups.length === 1 ? columns[0].style.getPropertyValue('--span') : 4);
    panel.append(content);

    // featured links open the drill-down of the same page when there is one
    ctx.featured.forEach((f) => {
      const a = f.querySelector('a');
      const path = pathKey(a);
      const drill = path && ctx.drills.find((d) => d.trigger.dataset.path === path);
      if (!drill) return;
      const btn = drill.trigger.cloneNode(true);
      f.replaceChildren(btn);
      f.classList.add('nav-drill-item');
      drill.alt = btn;
    });

    item.append(trigger, panel);
    menu.append(item);
    items.push({
      item, trigger, panel, content, drills: ctx.drills,
    });
  });

  const setDrill = (entry, drill, open) => {
    [drill.trigger, drill.alt].filter(Boolean).forEach((t) => t.setAttribute('aria-expanded', open));
    drill.view.hidden = !open;
    if (isDesktop.matches) {
      entry.panel.classList.toggle('nav-panel-drilled', open);
      entry.panel.style.minHeight = open ? `${drill.view.offsetHeight}px` : '';
    }
  };
  const closeDrills = (entry) => entry.drills.forEach((d) => {
    if (!d.view.hidden) setDrill(entry, d, false);
  });
  const setOpen = (entry, open) => {
    if (open) {
      items.filter((e) => e !== entry).forEach((e) => {
        // eslint-disable-next-line no-use-before-define
        close(e);
      });
    } else {
      closeDrills(entry);
    }
    entry.trigger.setAttribute('aria-expanded', open);
    entry.panel.hidden = !open;
    entry.item.classList.toggle('is-open', open);
  };
  const close = (entry) => {
    if (!entry.panel.hidden) setOpen(entry, false);
  };
  const closeAll = () => items.forEach(close);

  items.forEach((entry) => {
    const { item, trigger, panel } = entry;
    let timer;
    let hoverOpenedAt = 0;
    const hoverable = () => isDesktop.matches && canHover.matches;
    trigger.addEventListener('click', () => {
      const open = panel.hidden || (Date.now() - hoverOpenedAt < 400);
      setOpen(entry, open);
    });
    trigger.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowDown' && isDesktop.matches) {
        e.preventDefault();
        setOpen(entry, true);
        panel.querySelector('a, button')?.focus();
      }
    });
    item.addEventListener('mouseenter', () => {
      if (!hoverable()) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (panel.hidden) hoverOpenedAt = Date.now();
        setOpen(entry, true);
      }, HOVER_OPEN_DELAY);
    });
    item.addEventListener('mouseleave', () => {
      if (!hoverable()) return;
      clearTimeout(timer);
      timer = setTimeout(() => close(entry), HOVER_CLOSE_DELAY);
    });
    entry.drills.forEach((drill) => {
      [drill.trigger, drill.alt].filter(Boolean).forEach((t) => t.addEventListener('click', () => {
        const open = drill.view.hidden;
        closeDrills(entry);
        setDrill(entry, drill, open);
        drill.opener = t;
        if (open && isDesktop.matches) drill.back.focus();
      }));
      drill.back.addEventListener('click', () => {
        setDrill(entry, drill, false);
        (drill.opener || drill.trigger).focus();
      });
    });
  });

  // left/right arrows move between top-level items
  menu.addEventListener('keydown', (e) => {
    if (!isDesktop.matches || !['ArrowLeft', 'ArrowRight'].includes(e.code)) return;
    const tops = [...menu.querySelectorAll(':scope > li > button, :scope > li > a')];
    const i = tops.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    tops[(i + (e.code === 'ArrowRight' ? 1 : -1) + tops.length) % tops.length].focus();
  });
  document.addEventListener('pointerdown', (e) => {
    if (isDesktop.matches && !menu.contains(e.target)) closeAll();
  });
  menu.addEventListener('focusout', (e) => {
    if (isDesktop.matches && e.relatedTarget && !menu.contains(e.relatedTarget)) closeAll();
  });
  isDesktop.addEventListener('change', closeAll);

  /** Closes the innermost open level; returns false when nothing was open. */
  const closeInnermost = () => {
    const entry = items.find((e) => !e.panel.hidden);
    if (!entry) return false;
    const drill = entry.drills.find((d) => !d.view.hidden);
    if (drill) {
      setDrill(entry, drill, false);
      (drill.opener || drill.trigger).focus();
    } else {
      setOpen(entry, false);
      entry.trigger.focus();
    }
    return true;
  };

  const wrapper = navSections.querySelector('.default-content-wrapper') || navSections;
  wrapper.replaceChildren(menu);
  return { closeInnermost, closeAll };
}

/**
 * Builds a search form from an authored paragraph: placeholder text + link with a search icon.
 * The link href is the results URL; its first empty query param names the input (default `q`).
 * @param {Element} source The authored paragraph
 * @returns {HTMLFormElement}
 */
function buildSearch(source) {
  const link = source.querySelector('a[href]');
  const url = new URL(link ? link.getAttribute('href') : '/search', window.location);
  const placeholder = source.textContent.trim() || 'Search';
  const label = placeholder.replace(/(\.{3}|…)$/, '').trim();

  const form = document.createElement('form');
  form.className = 'nav-search';
  form.id = 'nav-search';
  form.setAttribute('role', 'search');
  form.method = 'get';
  form.action = `${url.origin}${url.pathname}`;

  let queryName;
  url.searchParams.forEach((value, key) => {
    if (!value && !queryName) {
      queryName = key;
    } else {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = key;
      hidden.value = value;
      form.append(hidden);
    }
  });

  const labelEl = document.createElement('label');
  labelEl.className = 'nav-search-label';
  labelEl.htmlFor = 'nav-search-input';
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.type = 'search';
  input.id = 'nav-search-input';
  input.name = queryName || 'q';
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.setAttribute('enterkeyhint', 'search');

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'nav-search-submit';
  submit.setAttribute('aria-label', 'Submit search');
  const icon = source.querySelector('.icon-search');
  if (icon) submit.append(icon);

  form.prepend(labelEl, input);
  form.append(submit);
  form.addEventListener('submit', (e) => {
    if (!input.value.trim()) {
      e.preventDefault();
      input.focus();
    }
  });
  return form;
}

/**
 * Builds the language selector. A list of language links (nested under the globe link,
 * or directly following it) becomes a disclosure menu; otherwise the link is used as-is.
 * @param {Element} source The authored paragraph or list containing the globe link
 * @param {Element} [sibling] An optional list authored right after the source
 * @returns {HTMLElement}
 */
function buildLanguage(source, sibling) {
  const lang = document.createElement('div');
  lang.className = 'nav-lang';
  const options = source.querySelector('li > ul') || sibling;
  const triggerLink = source.querySelector('a');

  if (!options) {
    if (triggerLink) lang.append(triggerLink);
    else lang.append(...source.childNodes);
    return lang;
  }

  options.remove();
  options.id = 'nav-lang-options';
  options.hidden = true;
  const links = [...options.querySelectorAll('a')];
  links.forEach((a) => {
    // mark the language of each option, e.g. /ja-jp/home -> lang="ja-jp"
    const code = new URL(a.href, window.location.href).pathname.split('/')[1];
    if (/^[a-z]{2}(-[a-z]{2})?$/i.test(code)) {
      a.lang = code;
      a.hreflang = code;
    }
  });

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', options.id);
  trigger.append(...(triggerLink || source).childNodes);
  const label = trigger.textContent.trim();
  if (label) trigger.setAttribute('aria-label', `Language: ${label}`);

  const setOpen = (open, focusIndex) => {
    trigger.setAttribute('aria-expanded', open);
    options.hidden = !open;
    if (open && focusIndex !== undefined) links.at(focusIndex)?.focus();
  };
  const onOutside = (e) => {
    if (!lang.contains(e.target)) setOpen(false);
  };
  document.addEventListener('pointerdown', onOutside);

  trigger.addEventListener('click', () => setOpen(options.hidden));
  trigger.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      e.preventDefault();
      setOpen(true, e.code === 'ArrowDown' ? 0 : -1);
    }
  });
  options.addEventListener('keydown', (e) => {
    const i = links.indexOf(document.activeElement);
    const keys = {
      ArrowDown: (i + 1) % links.length,
      ArrowUp: (i - 1 + links.length) % links.length,
      Home: 0,
      End: links.length - 1,
    };
    if (e.code in keys) {
      e.preventDefault();
      links[keys[e.code]].focus();
    }
  });
  lang.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !options.hidden) {
      e.stopPropagation();
      setOpen(false);
      trigger.focus();
    }
  });
  lang.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !lang.contains(e.relatedTarget)) setOpen(false);
  });
  lang.append(trigger, options);
  return lang;
}

/**
 * Decorates the tools section (search, account links, language) from authored content.
 * Each item is optional and detected by content rather than position.
 * @param {Element} nav The nav element
 * @param {Element} navTools The tools section
 */
function decorateTools(nav, navTools) {
  const items = [...navTools.querySelectorAll('.default-content-wrapper > *')];
  const searchSource = items.find((el) => el.querySelector('.icon-search'));
  const langSource = items.find((el) => el.querySelector('.icon-globe'));
  const next = langSource?.nextElementSibling;
  const langList = langSource?.tagName === 'P' && next?.matches('ul, ol') ? next : undefined;
  const accountSource = items.find((el) => ![searchSource, langSource, langList].includes(el) && el.querySelector('a'));

  const form = searchSource ? buildSearch(searchSource) : null;

  const utility = document.createElement('div');
  utility.className = 'nav-utility';
  if (accountSource) {
    const account = document.createElement('ul');
    account.className = 'nav-account';
    accountSource.querySelectorAll('a').forEach((a) => {
      const li = document.createElement('li');
      li.append(a);
      account.append(li);
    });
    utility.append(account);
  }
  if (langSource) utility.append(buildLanguage(langSource, langList));

  navTools.replaceChildren(...[form, utility].filter(Boolean));

  if (!form) return;
  // mobile: icon button that reveals the search row
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-search-toggle';
  toggle.setAttribute('aria-controls', form.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open search');
  const toggleIcon = form.querySelector('.nav-search-submit img');
  if (toggleIcon) {
    const clone = toggleIcon.cloneNode();
    clone.alt = '';
    toggle.append(clone);
  }

  const setSearchOpen = (open, restoreFocus = false) => {
    nav.dataset.searchOpen = open;
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close search' : 'Open search');
    if (open) form.querySelector('input[type="search"]').focus();
    else if (restoreFocus) toggle.focus();
  };
  toggle.addEventListener('click', () => setSearchOpen(nav.dataset.searchOpen !== 'true'));
  form.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !isDesktop.matches && nav.dataset.searchOpen === 'true') {
      e.stopPropagation();
      setSearchOpen(false, true);
    }
  });
  isDesktop.addEventListener('change', () => setSearchOpen(false));
  nav.dataset.searchOpen = 'false';
  nav.append(toggle);
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  if (navBrand) {
    const brandLink = navBrand.querySelector('a');
    if (brandLink) {
      brandLink.className = '';
      const wrapper = brandLink.closest('.button-wrapper');
      if (wrapper) wrapper.className = '';
      brandLink.setAttribute('aria-label', 'Molex home');
    }
    navBrand.querySelectorAll('.icon img').forEach((img) => {
      img.loading = 'eager';
      img.removeAttribute('width');
      img.removeAttribute('height');
    });
  }

  const navTools = nav.querySelector('.nav-tools');
  if (navTools) decorateTools(nav, navTools);

  const navSections = nav.querySelector('.nav-sections');
  const menu = navSections ? decorateSections(navSections) : null;

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-expanded="false" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav));
  nav.prepend(hamburger);
  toggleMenu(nav, false);
  isDesktop.addEventListener('change', () => toggleMenu(nav, false));

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (menu?.closeInnermost()) return;
    if (!isDesktop.matches && nav.getAttribute('aria-expanded') === 'true') {
      toggleMenu(nav, false);
      hamburger.querySelector('button').focus();
    }
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
