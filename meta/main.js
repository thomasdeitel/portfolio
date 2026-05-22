import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

const REPOSITORY_URL = 'https://github.com/thomasdeitel/portfolio';

let commits = [];
let filteredCommits = [];
let commitProgress = 100;
let timeScale;
let xScale;
let yScale;
const languageColors = d3.scaleOrdinal(d3.schemeTableau10);

async function loadData() {
  return d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(`${row.date}T00:00${row.timezone}`),
    datetime: new Date(row.datetime),
  }));
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const ret = {
        id: commit,
        url: `${REPOSITORY_URL}/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: true,
        writable: true,
        enumerable: false,
      });

      return ret;
    })
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));
}

function formatNumber(value, digits = 0) {
  return d3.format(`,.${digits}f`)(value);
}

function appendStat(dl, label, value) {
  dl.append('dt').html(label);
  dl.append('dd').text(value);
}

function renderCommitInfo(data, commitData) {
  const stats = d3.select('#stats');
  stats.selectAll('*').remove();

  const fileLengths = d3.rollups(
    data,
    (lines) => d3.max(lines, (line) => line.line),
    (line) => line.file,
  );
  const longestFile = d3.greatest(fileLengths, (file) => file[1]);
  const workByDay = d3.rollups(
    commitData,
    (rows) => d3.sum(rows, (commit) => commit.totalLines),
    (commit) => commit.datetime.toLocaleString('en', { weekday: 'long' }),
  );
  const busiestDay = d3.greatest(workByDay, (day) => day[1]);
  const workByPeriod = d3.rollups(
    commitData,
    (rows) => d3.sum(rows, (commit) => commit.totalLines),
    (commit) => commit.datetime.toLocaleString('en', { dayPeriod: 'short' }),
  );
  const busiestPeriod = d3.greatest(workByPeriod, (period) => period[1]);

  const dl = stats.append('dl').attr('class', 'stats');
  appendStat(dl, 'Total <abbr title="Lines of code">LOC</abbr>', formatNumber(data.length));
  appendStat(dl, 'Total commits', formatNumber(commitData.length));
  appendStat(dl, 'Files', formatNumber(d3.group(data, (d) => d.file).size));
  appendStat(dl, 'Average line length', `${formatNumber(d3.mean(data, (d) => d.length), 1)} chars`);
  appendStat(dl, 'Maximum depth', formatNumber(d3.max(data, (d) => d.depth)));
  appendStat(dl, 'Longest file', `${longestFile?.[0] ?? 'N/A'} (${formatNumber(longestFile?.[1] ?? 0)} lines)`);
  appendStat(dl, 'Average file length', `${formatNumber(d3.mean(fileLengths, (file) => file[1]), 1)} lines`);
  appendStat(dl, 'Most active day', `${busiestDay?.[0] ?? 'N/A'} (${formatNumber(busiestDay?.[1] ?? 0)} lines)`);
  appendStat(dl, 'Most active period', `${busiestPeriod?.[0] ?? 'N/A'} (${formatNumber(busiestPeriod?.[1] ?? 0)} lines)`);
}

function renderTooltipContent(commit) {
  if (!commit || Object.keys(commit).length === 0) {
    return;
  }

  document.getElementById('commit-link').href = commit.url;
  document.getElementById('commit-link').textContent = commit.id;
  document.getElementById('commit-date').textContent = commit.datetime.toLocaleString('en', {
    dateStyle: 'full',
  });
  document.getElementById('tooltip-commit-time').textContent = commit.datetime.toLocaleString('en', {
    timeStyle: 'short',
  });
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = d3.format(',')(commit.totalLines);
}

function updateTooltipVisibility(isVisible) {
  document.getElementById('commit-tooltip').hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  const offset = 14;
  tooltip.style.left = `${event.clientX + offset}px`;
  tooltip.style.top = `${event.clientY + offset}px`;
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }

  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function getSelectedCommits(selection) {
  return selection ? filteredCommits.filter((commit) => isCommitSelected(selection, commit)) : [];
}

function renderSelectionCount(selection) {
  const selectedCommits = getSelectedCommits(selection);
  const countElement = document.querySelector('#selection-count');
  const count = selectedCommits.length;
  countElement.textContent = `${count || 'No'} commit${count === 1 ? '' : 's'} selected`;
  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = getSelectedCommits(selection);
  const container = document.getElementById('language-breakdown');

  container.innerHTML = '';

  if (selectedCommits.length === 0) {
    return;
  }

  const lines = selectedCommits.flatMap((commit) => commit.lines);
  const breakdown = d3.rollup(
    lines,
    (rows) => rows.length,
    (line) => line.type,
  );

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    container.insertAdjacentHTML(
      'beforeend',
      `
        <dt>${language}</dt>
        <dd>${count} lines (${d3.format('.1~%')(proportion)})</dd>
      `,
    );
  }
}

function getChartDimensions() {
  const width = 1000;
  const height = 600;
  const margin = { top: 20, right: 24, bottom: 44, left: 56 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  return { width, height, margin, usableArea };
}

function setCircleAttributes(selection, rScale) {
  selection
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .style('--r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue');
}

function addCircleInteractions(selection) {
  selection
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

function updateSelectionInfo(selection = null) {
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function renderScatterPlot() {
  const { width, height, usableArea } = getChartDimensions();
  const chart = d3.select('#chart');
  chart.selectAll('*').remove();

  const svg = chart
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', 'Scatterplot of commits by date and time of day')
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(filteredCommits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  const [minLines, maxLines] = d3.extent(filteredCommits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([3, 28]);

  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(d3.axisBottom(xScale));

  svg
    .append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickFormat((d) => `${String(d % 24).padStart(2, '0')}:00`),
    );

  const dots = svg.append('g').attr('class', 'dots');
  const sortedCommits = d3.sort(filteredCommits, (d) => -d.totalLines);

  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .call((selection) => setCircleAttributes(selection, rScale))
    .call(addCircleInteractions);

  function brushed(event) {
    const selection = event.selection;
    dots
      .selectAll('circle')
      .classed('selected', (commit) => isCommitSelected(selection, commit));
    updateSelectionInfo(selection);
  }

  svg.call(d3.brush().on('start brush end', brushed));
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function updateScatterPlot() {
  const { usableArea } = getChartDimensions();
  const svg = d3.select('#chart').select('svg');

  if (svg.empty()) {
    renderScatterPlot();
    return;
  }

  xScale = xScale.domain(d3.extent(filteredCommits, (d) => d.datetime)).nice();

  const [minLines, maxLines] = d3.extent(filteredCommits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([3, 28]);

  svg.select('g.x-axis').call(d3.axisBottom(xScale));

  const sortedCommits = d3.sort(filteredCommits, (d) => -d.totalLines);
  svg
    .select('g.dots')
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .call((selection) => setCircleAttributes(selection, rScale))
    .call(addCircleInteractions);

  svg.select('.brush').call(d3.brush().move, null);
  svg.selectAll('.dots, .overlay ~ *').raise();
  updateSelectionInfo();
}

function updateFileDisplay(commitData) {
  const lines = commitData.flatMap((commit) => commit.lines);
  const files = d3
    .groups(lines, (line) => line.file)
    .map(([name, fileLines]) => ({ name, lines: fileLines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join((enter) =>
      enter.append('div').call((div) => {
        div.append('dt').append('code');
        div.select('dt').append('small');
        div.append('dd');
      }),
    );

  filesContainer.select('dt > code').text((d) => d.name);
  filesContainer.select('dt > small').text((d) => `${d.lines.length} lines`);
  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines, (d) => `${d.commit}-${d.file}-${d.line}`)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${languageColors(d.type)}`);
}

function setCommitMaxTime(maxTime) {
  const commitMinTime = d3.min(commits, (d) => d.datetime);
  const commitMaxTime = maxTime ?? timeScale.invert(commitProgress);
  filteredCommits = commits.filter((commit) => commit.datetime <= commitMaxTime);

  if (filteredCommits.length === 0) {
    filteredCommits = commits.filter((commit) => commit.datetime.getTime() === commitMinTime.getTime());
  }

  commitProgress = timeScale(commitMaxTime);
  document.getElementById('commit-progress').value = commitProgress;
  document.getElementById('commit-time').textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const filteredLines = filteredCommits.flatMap((commit) => commit.lines);
  renderCommitInfo(filteredLines, filteredCommits);
  updateScatterPlot();
  updateFileDisplay(filteredCommits);
}

function onTimeSliderChange(event) {
  commitProgress = Number(event.currentTarget.value);
  setCommitMaxTime(timeScale.invert(commitProgress));
}

function renderCommitStory() {
  d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits, (d) => d.id)
    .join('div')
    .attr('class', 'step')
    .html(
      (d, i) => `
        <p>
          On ${d.datetime.toLocaleString('en', { dateStyle: 'full', timeStyle: 'short' })},
          I made <a href="${d.url}" target="_blank" rel="noopener noreferrer">${
            i > 0 ? 'another commit' : 'my first commit in this dataset'
          }</a>.
        </p>
        <p>
          This update touched ${d.totalLines} lines across ${
            d3.rollups(
              d.lines,
              (lines) => lines.length,
              (line) => line.file,
            ).length
          } files.
        </p>
      `,
    );
}

function setupScrollytelling() {
  const scroller = scrollama();
  scroller
    .setup({
      container: '#scrolly-1',
      step: '#scrolly-1 .step',
      offset: 0.55,
    })
    .onStepEnter((response) => {
      setCommitMaxTime(response.element.__data__.datetime);
    });

  window.addEventListener('resize', scroller.resize);
}

const data = await loadData();
commits = processCommits(data);
filteredCommits = commits;
timeScale = d3
  .scaleTime()
  .domain(d3.extent(commits, (d) => d.datetime))
  .range([0, 100]);

document.getElementById('commit-progress').addEventListener('input', onTimeSliderChange);
renderScatterPlot();
renderCommitStory();
setupScrollytelling();
setCommitMaxTime(d3.max(commits, (d) => d.datetime));
