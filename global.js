console.log("IT'S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

window.$$ = $$;

const pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact' },
  { url: 'resume/', title: 'Resume' },
  { url: 'https://github.com/thomasdeitel', title: 'GitHub' },
];

const BASE_URL = new URL('.', import.meta.url);
const BASE_PATH = normalizePathname(BASE_URL.pathname);
const CURRENT_PATH = normalizePathname(location.pathname);
const COLOR_SCHEMES = new Set(['light dark', 'light', 'dark']);

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function isCurrentPage(link) {
  const linkPath = normalizePathname(link.pathname);

  return (
    CURRENT_PATH === linkPath ||
    (linkPath !== BASE_PATH && CURRENT_PATH.startsWith(linkPath))
  );
}

const nav = document.createElement('nav');

for (const page of pages) {
  const a = document.createElement('a');
  const isExternal = page.url.startsWith('http');

  a.href = isExternal ? page.url : new URL(page.url, BASE_URL).toString();
  a.textContent = page.title;

  if (a.host !== location.host) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }

  nav.append(a);
}

document.body.prepend(nav);

const navLinks = $$('a', nav);
const currentLink = navLinks
  .filter((link) => link.host === location.host)
  .sort((first, second) => second.pathname.length - first.pathname.length)
  .find((link) => isCurrentPage(link));

currentLink?.classList.add('current');

document.body.insertAdjacentHTML(
  'afterbegin',
  `
    <label class="color-scheme">
      Theme:
      <select>
        <option value="light dark">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  `,
);

const colorSchemeSelect = document.querySelector('.color-scheme select');

function applyColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  colorSchemeSelect.value = colorScheme;
}

const savedColorScheme = localStorage.colorScheme;
applyColorScheme(
  COLOR_SCHEMES.has(savedColorScheme) ? savedColorScheme : 'light dark',
);

colorSchemeSelect.addEventListener('input', (event) => {
  const { value } = event.target;

  if (!COLOR_SCHEMES.has(value)) {
    return;
  }

  applyColorScheme(value);
  localStorage.colorScheme = value;
});

const contactForm = document.querySelector('form[action^="mailto:"]');

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const email = data.get('email')?.toString().trim();
  const subject = data.get('subject')?.toString().trim() ?? '';
  const message = data.get('body')?.toString().trim() ?? '';
  const body = email ? `Reply to: ${email}\n\n${message}` : message;
  const params = [];

  if (subject) {
    params.push(`subject=${encodeURIComponent(subject)}`);
  }

  if (body) {
    params.push(`body=${encodeURIComponent(body)}`);
  }

  location.href = `${form.action}${params.length ? `?${params.join('&')}` : ''}`;
});
