'use strict';

const CONFIG = {
  OWM_API_KEY:  '99ea8b161ff9a19359726e1caf212bfa',
  DEFAULT_CITY: 'Kolkata',
  DEFAULT_LAT:  22.5744,
  DEFAULT_LON:  88.3629,
  ICON_BASE:    'https://cdn.jsdelivr.net/gh/basmilius/weather-icons@master/production/fill/svg/',
  FORECAST_MAX: 16, // Open-Meteo free tier maximum days

  WMO: {
    0:  { label: 'Clear Sky',            day: 'clear-day',          night: 'clear-night',         bg: 'clear'    },
    1:  { label: 'Mainly Clear',         day: 'partly-cloudy-day',  night: 'partly-cloudy-night', bg: 'clear'    },
    2:  { label: 'Partly Cloudy',        day: 'partly-cloudy-day',  night: 'partly-cloudy-night', bg: 'cloudy'   },
    3:  { label: 'Overcast',             day: 'overcast',           night: 'overcast',            bg: 'overcast' },
    45: { label: 'Foggy',               day: 'fog',                night: 'fog',                 bg: 'fog'      },
    48: { label: 'Icy Fog',             day: 'fog',                night: 'fog',                 bg: 'fog'      },
    51: { label: 'Light Drizzle',       day: 'drizzle',            night: 'drizzle',             bg: 'rain'     },
    53: { label: 'Drizzle',             day: 'drizzle',            night: 'drizzle',             bg: 'rain'     },
    55: { label: 'Heavy Drizzle',       day: 'drizzle',            night: 'drizzle',             bg: 'rain'     },
    61: { label: 'Light Rain',          day: 'rain',               night: 'rain',                bg: 'rain'     },
    63: { label: 'Rain',                day: 'rain',               night: 'rain',                bg: 'rain'     },
    65: { label: 'Heavy Rain',          day: 'rain',               night: 'rain',                bg: 'rain'     },
    71: { label: 'Light Snow',          day: 'snow',               night: 'snow',                bg: 'snow'     },
    73: { label: 'Snow',                day: 'snow',               night: 'snow',                bg: 'snow'     },
    75: { label: 'Heavy Snow',          day: 'snow',               night: 'snow',                bg: 'snow'     },
    77: { label: 'Snow Grains',         day: 'snow',               night: 'snow',                bg: 'snow'     },
    80: { label: 'Rain Showers',        day: 'rain',               night: 'rain',                bg: 'rain'     },
    81: { label: 'Rain Showers',        day: 'rain',               night: 'rain',                bg: 'rain'     },
    82: { label: 'Heavy Showers',       day: 'rain',               night: 'rain',                bg: 'rain'     },
    85: { label: 'Snow Showers',        day: 'snow',               night: 'snow',                bg: 'snow'     },
    86: { label: 'Heavy Snow Showers',  day: 'snow',               night: 'snow',                bg: 'snow'     },
    95: { label: 'Thunderstorm',        day: 'thunderstorms',      night: 'thunderstorms',       bg: 'thunder'  },
    96: { label: 'Thunderstorm + Hail', day: 'thunderstorms-rain', night: 'thunderstorms-rain',  bg: 'thunder'  },
    99: { label: 'Severe Thunderstorm', day: 'thunderstorms-rain', night: 'thunderstorms-rain',  bg: 'thunder'  },
  },

  AQI: [
    { max: 20,       label: 'Good',      color: '#4ade80', bg: 'rgba(74,222,128,0.15)',   desc: 'Air quality is excellent. Enjoy all outdoor activities.' },
    { max: 40,       label: 'Fair',      color: '#a3e635', bg: 'rgba(163,230,53,0.15)',   desc: 'Acceptable quality. Unusually sensitive people may be affected.' },
    { max: 60,       label: 'Moderate',  color: '#facc15', bg: 'rgba(250,204,21,0.15)',   desc: 'Sensitive groups may experience health effects. Reduce prolonged exertion.' },
    { max: 80,       label: 'Poor',      color: '#fb923c', bg: 'rgba(251,146,60,0.15)',   desc: 'Everyone may begin to experience effects. Limit time outdoors.' },
    { max: 100,      label: 'Very Poor', color: '#f87171', bg: 'rgba(248,113,113,0.15)',  desc: 'Health alert. Everyone may experience serious effects. Avoid outdoors.' },
    { max: Infinity, label: 'Hazardous', color: '#c084fc', bg: 'rgba(192,132,252,0.15)', desc: 'Emergency conditions. Stay indoors with windows closed.' },
  ],

  WIND_DIRS: ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'],

  UV_LABELS: [
    { max: 2,        label: 'Low',       color: '#4ade80' },
    { max: 5,        label: 'Moderate',  color: '#facc15' },
    { max: 7,        label: 'High',      color: '#fb923c' },
    { max: 10,       label: 'Very High', color: '#f87171' },
    { max: Infinity, label: 'Extreme',   color: '#c084fc' },
  ],

  BG: {
    clear:    { day: 'linear-gradient(160deg,#0f2952 0%,#1a4a8a 40%,#2d7dd2 100%)',  night: 'linear-gradient(160deg,#040812 0%,#0d1b35 50%,#0a1528 100%)' },
    cloudy:   { day: 'linear-gradient(160deg,#1a2035 0%,#2d3a50 50%,#3d4f68 100%)',  night: 'linear-gradient(160deg,#0d1020 0%,#181e2e 50%,#1e2840 100%)' },
    overcast: { day: 'linear-gradient(160deg,#141820 0%,#1e2430 50%,#252e3a 100%)',  night: 'linear-gradient(160deg,#0a0c0f 0%,#111520 50%,#161c25 100%)' },
    rain:     { day: 'linear-gradient(160deg,#0d1b2a 0%,#152238 50%,#1a2d4a 100%)',  night: 'linear-gradient(160deg,#080c12 0%,#0e1520 50%,#0d1828 100%)' },
    thunder:  { day: 'linear-gradient(160deg,#0a0a14 0%,#12101e 50%,#1a1528 100%)',  night: 'linear-gradient(160deg,#060608 0%,#0c0a12 50%,#100d18 100%)' },
    snow:     { day: 'linear-gradient(160deg,#2a3545 0%,#354560 50%,#3d5478 100%)',  night: 'linear-gradient(160deg,#111820 0%,#1a2535 50%,#1e2d40 100%)' },
    fog:      { day: 'linear-gradient(160deg,#1e2530 0%,#2a3345 50%,#303d50 100%)',  night: 'linear-gradient(160deg,#111520 0%,#181e28 50%,#1e2530 100%)' },
  },

  EMOJI: {
    0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
    51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',
    71:'🌨️',73:'❄️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',
    85:'🌨️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️',
  },
};
