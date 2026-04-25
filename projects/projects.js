import { fetchJSON, renderProjects } from '../global.js';

const projects = (await fetchJSON('../lib/projects.json')) ?? [];
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');

if (projectsTitle) {
  projectsTitle.innerHTML = `Projects <span class="project-count">${projects.length}</span>`;
}

if (projectsContainer) {
  renderProjects(projects, projectsContainer, 'h2');
}
