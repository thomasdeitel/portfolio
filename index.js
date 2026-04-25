import { fetchGitHubData, fetchJSON, renderProjects } from './global.js';

const projects = (await fetchJSON('./lib/projects.json')) ?? [];
const latestProjects = projects.slice(0, 3);
const projectsContainer = document.querySelector('.projects');

if (projectsContainer) {
  renderProjects(latestProjects, projectsContainer, 'h2');
}

const githubData = await fetchGitHubData('thomasdeitel');
const profileStats = document.querySelector('#profile-stats');

if (profileStats) {
  if (!githubData) {
    profileStats.innerHTML = '<p class="stats-error">GitHub stats are unavailable right now.</p>';
  } else {
    profileStats.innerHTML = `
      <dl>
        <div>
          <dt>Public Repos</dt>
          <dd>${githubData.public_repos}</dd>
        </div>
        <div>
          <dt>Public Gists</dt>
          <dd>${githubData.public_gists}</dd>
        </div>
        <div>
          <dt>Followers</dt>
          <dd>${githubData.followers}</dd>
        </div>
        <div>
          <dt>Following</dt>
          <dd>${githubData.following}</dd>
        </div>
      </dl>
    `;
  }
}
