import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = (await fetchJSON('../lib/projects.json')) ?? [];
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');
const svg = d3.select('#projects-pie-plot');
const legend = d3.select('.legend');
const colors = d3.scaleOrdinal(d3.schemeTableau10);
const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

let query = '';
let selectedYear = null;

function projectMatchesQuery(project, searchQuery) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const values = Object.values(project).join('\n').toLowerCase();
  return values.includes(normalizedQuery);
}

function setProjectCount(count) {
  if (projectsTitle) {
    projectsTitle.innerHTML = `Projects <span class="project-count">${count}</span>`;
  }
}

function getQueryFilteredProjects() {
  return projects.filter((project) => projectMatchesQuery(project, query));
}

function getVisibleProjects(queryFilteredProjects) {
  if (!selectedYear) {
    return queryFilteredProjects;
  }

  return queryFilteredProjects.filter((project) => project.year?.toString() === selectedYear);
}

function updateSelectedClasses() {
  svg
    .selectAll('path')
    .attr('class', (d) => (d.data.label === selectedYear ? 'selected' : null))
    .attr('aria-pressed', (d) => String(d.data.label === selectedYear));

  legend
    .selectAll('li')
    .attr('class', (d) => `legend-item${d.label === selectedYear ? ' selected' : ''}`)
    .attr('aria-pressed', (d) => String(d.label === selectedYear));
}

function applyFilters() {
  const queryFilteredProjects = getQueryFilteredProjects();
  const selectableYears = new Set(queryFilteredProjects.map((project) => project.year?.toString()));

  if (selectedYear && !selectableYears.has(selectedYear)) {
    selectedYear = null;
  }

  const visibleProjects = getVisibleProjects(queryFilteredProjects);

  renderProjects(visibleProjects, projectsContainer, 'h2');
  renderPieChart(queryFilteredProjects);
  setProjectCount(visibleProjects.length);
}

function toggleYear(year) {
  selectedYear = selectedYear === year ? null : year;
  applyFilters();
}

function handleYearKeydown(event, year) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  toggleYear(year);
}

function renderPieChart(projectsGiven) {
  const rolledData = d3.rollups(
    projectsGiven,
    (projectGroup) => projectGroup.length,
    (project) => project.year,
  );

  const data = rolledData
    .map(([year, count]) => ({ value: count, label: year?.toString() ?? 'Unknown' }))
    .sort((first, second) => d3.descending(first.label, second.label));

  const sliceGenerator = d3.pie().value((d) => d.value);
  const arcData = sliceGenerator(data);

  svg.selectAll('path').remove();
  legend.selectAll('li').remove();

  if (data.length === 0) {
    return;
  }

  svg
    .selectAll('path')
    .data(arcData)
    .join('path')
    .attr('d', arcGenerator)
    .attr('fill', (_, index) => colors(index))
    .style('--color', (_, index) => colors(index))
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', (d) => `${d.data.label}: ${d.data.value} project${d.data.value === 1 ? '' : 's'}`)
    .on('click', (_, d) => toggleYear(d.data.label))
    .on('keydown', (event, d) => handleYearKeydown(event, d.data.label));

  const legendItems = legend
    .selectAll('li')
    .data(data)
    .join('li')
    .attr('style', (_, index) => `--color: ${colors(index)}`)
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', (d) => `Filter projects from ${d.label}`)
    .on('click', (_, d) => toggleYear(d.label))
    .on('keydown', (event, d) => handleYearKeydown(event, d.label));

  legendItems.append('span').attr('class', 'swatch').attr('aria-hidden', 'true');
  legendItems.append('span').text((d) => d.label);
  legendItems.append('em').text((d) => `(${d.value})`);

  updateSelectedClasses();
}

searchInput?.addEventListener('input', (event) => {
  query = event.target.value;
  applyFilters();
});

if (projectsContainer) {
  applyFilters();
}
