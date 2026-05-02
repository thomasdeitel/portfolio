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
const HEADING_LEVEL_PATTERN = /^h[1-6]$/i;
const FALLBACK_PROJECT_IMAGE = 'https://dsc106.com/labs/lab02/images/empty.svg';

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

function resolveURL(path) {
  return new URL(path, BASE_URL).toString();
}

export async function fetchJSON(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch JSON data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
    return null;
  }
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  if (!(containerElement instanceof Element)) {
    console.error('renderProjects expected a valid container element.');
    return;
  }

  containerElement.innerHTML = '';

  if (!Array.isArray(projects) || projects.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className = 'projects-empty';
    placeholder.textContent = 'Projects coming soon.';
    containerElement.append(placeholder);
    return;
  }

  const headingTag = HEADING_LEVEL_PATTERN.test(headingLevel) ? headingLevel.toLowerCase() : 'h2';

  for (const project of projects) {
    const article = document.createElement('article');
    const heading = document.createElement(headingTag);
    const title = project.title?.trim() || 'Untitled Project';
    const year = project.year?.toString().trim();
    const description = project.description?.trim() || 'Description coming soon.';
    const imageSource = resolveURL(project.image?.trim() || FALLBACK_PROJECT_IMAGE);
    const imageAlt = project.imageAlt?.trim() || `Preview image for ${title}`;
    const projectURL = project.url?.trim() ? resolveURL(project.url.trim()) : null;

    if (projectURL) {
      const titleLink = document.createElement('a');
      titleLink.href = projectURL;
      titleLink.className = 'project-link';
      titleLink.textContent = title;
      heading.append(titleLink);
    } else {
      heading.textContent = title;
    }

    article.append(heading);

    const image = document.createElement('img');
    image.src = imageSource;
    image.alt = imageAlt;

    if (projectURL) {
      const imageLink = document.createElement('a');
      imageLink.href = projectURL;
      imageLink.className = 'project-media';
      imageLink.append(image);
      article.append(imageLink);
    } else {
      article.append(image);
    }

    const projectInfo = document.createElement('div');
    projectInfo.className = 'project-info';

    const descriptionElement = document.createElement('p');
    descriptionElement.className = 'project-description';
    descriptionElement.textContent = description;
    projectInfo.append(descriptionElement);

    if (year) {
      const yearElement = document.createElement('p');
      yearElement.className = 'project-year';
      yearElement.textContent = year;
      projectInfo.append(yearElement);
    }

    article.append(projectInfo);

    containerElement.append(article);
  }
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}

export const fetchGithubData = fetchGitHubData;

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
