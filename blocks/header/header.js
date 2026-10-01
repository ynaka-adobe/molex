import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  if (navSections) {
    const navDrops = navSections.querySelectorAll('.nav-drop');
    if (isDesktop.matches) {
      navDrops.forEach((drop) => {
        if (!drop.hasAttribute('tabindex')) {
          drop.setAttribute('tabindex', 0);
          drop.addEventListener('focus', focusNavSection);
        }
      });
    } else {
      navDrops.forEach((drop) => {
        drop.removeAttribute('tabindex');
        drop.removeEventListener('focus', focusNavSection);
      });
    }
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
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
  if (navSections) {
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        }
      });
    });
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
