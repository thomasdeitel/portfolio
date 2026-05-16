import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoidG9tZDEwIiwiYSI6ImNtcDdsMzl0NTAzYTEycnBzb3dhczIzdzcifQ.9y6X-UzjxapXgfZFcpf6-Q';
const BOSTON_BIKE_LANES_URL = 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson';
const CAMBRIDGE_BIKE_LANES_URL = 'https://services1.arcgis.com/WnzC35krSYGuYov4/ArcGIS/rest/services/Bike_Facilities/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson';
const BLUEBIKES_STATIONS_URL = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
const BLUEBIKES_TRAFFIC_URL = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
const MINUTES_IN_DAY = 1440;
const FILTER_WINDOW_MINUTES = 60;

let departuresByMinute = Array.from({ length: MINUTES_IN_DAY }, () => []);
let arrivalsByMinute = Array.from({ length: MINUTES_IN_DAY }, () => []);

const tokenWarning = document.querySelector('.map-token-warning');
const loading = document.querySelector('.loading');
const savedToken = localStorage.getItem('mapboxAccessToken');
const hasValidTokenShape = (token) => token?.startsWith('pk.') && token.length > 20;
const configuredToken = hasValidTokenShape(savedToken) ? savedToken : MAPBOX_ACCESS_TOKEN;

if (!hasValidTokenShape(configuredToken) || configuredToken === 'YOUR_MAPBOX_ACCESS_TOKEN_HERE') {
  tokenWarning.hidden = false;
  loading.hidden = true;
  throw new Error('Mapbox access token is missing. Add it to map.js or localStorage.');
}

mapboxgl.accessToken = configuredToken;
console.log('Mapbox GL JS Loaded:', mapboxgl);

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');

const svg = d3.select('#map').select('svg');
const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);
const radiusScale = d3.scaleSqrt().range([0, 25]);

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) {
    return tripsByMinute.flat();
  }

  const minMinute = (minute - FILTER_WINDOW_MINUTES + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const maxMinute = (minute + FILTER_WINDOW_MINUTES) % MINUTES_IN_DAY;

  if (minMinute > maxMinute) {
    return tripsByMinute.slice(minMinute).concat(tripsByMinute.slice(0, maxMinute + 1)).flat();
  }

  return tripsByMinute.slice(minMinute, maxMinute + 1).flat();
}

function computeStationTraffic(stations, timeFilter = -1) {
  const departures = d3.rollup(
    filterByMinute(departuresByMinute, timeFilter),
    (trips) => trips.length,
    (trip) => trip.start_station_id,
  );

  const arrivals = d3.rollup(
    filterByMinute(arrivalsByMinute, timeFilter),
    (trips) => trips.length,
    (trip) => trip.end_station_id,
  );

  return stations.map((station) => {
    const id = station.short_name;
    return {
      ...station,
      arrivals: arrivals.get(id) ?? 0,
      departures: departures.get(id) ?? 0,
      totalTraffic: (arrivals.get(id) ?? 0) + (departures.get(id) ?? 0),
    };
  });
}

function addBikeLaneLayer(sourceId, layerId, data) {
  map.addSource(sourceId, {
    type: 'geojson',
    data,
  });

  map.addLayer({
    id: layerId,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': '#1fa66a',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 14, 4, 17, 7],
      'line-opacity': 0.56,
    },
  });
}

function getDepartureRatio(station) {
  if (!station.totalTraffic) {
    return 0.5;
  }

  return stationFlow(station.departures / station.totalTraffic);
}

map.on('load', async () => {
  addBikeLaneLayer('boston_route', 'boston-bike-lanes', BOSTON_BIKE_LANES_URL);
  addBikeLaneLayer('cambridge_route', 'cambridge-bike-lanes', CAMBRIDGE_BIKE_LANES_URL);

  const [stationJson, trips] = await Promise.all([
    d3.json(BLUEBIKES_STATIONS_URL),
    d3.csv(BLUEBIKES_TRAFFIC_URL, (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);

      const startedMinutes = minutesSinceMidnight(trip.started_at);
      const endedMinutes = minutesSinceMidnight(trip.ended_at);
      departuresByMinute[startedMinutes].push(trip);
      arrivalsByMinute[endedMinutes].push(trip);

      return trip;
    }),
  ]);

  console.log('Loaded JSON Data:', stationJson);
  console.log('Loaded traffic rows:', trips.length);

  const baseStations = stationJson.data.stations;
  let stations = computeStationTraffic(baseStations);
  radiusScale.domain([0, d3.max(stations, (station) => station.totalTraffic)]);

  const circles = svg
    .selectAll('circle')
    .data(stations, (station) => station.short_name)
    .enter()
    .append('circle')
    .attr('r', (station) => radiusScale(station.totalTraffic))
    .style('--departure-ratio', getDepartureRatio);

  circles.append('title');

  function updateTitles(selection) {
    selection.select('title').text(
      (station) =>
        `${station.name}: ${station.totalTraffic} trips (${station.departures} departures, ${station.arrivals} arrivals)`,
    );
  }

  function updatePositions() {
    circles
      .attr('cx', (station) => getCoords(station).cx)
      .attr('cy', (station) => getCoords(station).cy);
  }

  function updateScatterPlot(timeFilter) {
    stations = computeStationTraffic(baseStations, timeFilter);
    radiusScale.domain([0, d3.max(stations, (station) => station.totalTraffic)]);
    radiusScale.range(timeFilter === -1 ? [0, 25] : [3, 50]);

    circles
      .data(stations, (station) => station.short_name)
      .attr('r', (station) => radiusScale(station.totalTraffic))
      .style('--departure-ratio', getDepartureRatio)
      .call(updateTitles);
  }

  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);

  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('selected-time');
  const anyTimeLabel = document.getElementById('any-time');

  function updateTimeDisplay() {
    const timeFilter = Number(timeSlider.value);

    if (timeFilter === -1) {
      selectedTime.textContent = '';
      anyTimeLabel.style.display = 'block';
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = 'none';
    }

    updateScatterPlot(timeFilter);
  }

  updateTitles(circles);
  updatePositions();
  updateTimeDisplay();
  timeSlider.addEventListener('input', updateTimeDisplay);
  loading.hidden = true;
});
