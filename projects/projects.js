import { fetchJSON, renderProjects } from '../global.js';

const projects = ((await fetchJSON('../lib/projects.json')) ?? [])
  .sort((first, second) => (Number(second.year) || 0) - (Number(first.year) || 0));
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');

function renderFilteredProjects() {
  const query = searchInput?.value.trim().toLowerCase() ?? '';
  const visibleProjects = projects.filter((project) =>
    Object.values(project).join('\n').toLowerCase().includes(query),
  );

  renderProjects(visibleProjects, projectsContainer, 'h2');

  if (projectsTitle) {
    projectsTitle.textContent = 'Projects ';
    const count = document.createElement('span');
    count.className = 'project-count';
    count.textContent = visibleProjects.length;
    projectsTitle.append(count);
  }
}

searchInput?.addEventListener('input', renderFilteredProjects);

if (projectsContainer) {
  renderFilteredProjects();
}
