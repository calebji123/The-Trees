# The Trees - Deforestation Visualization

Interactive D3.js globe visualization showing global deforestation hotspots.

## Project Structure

```
The-Trees/
├── index.html              # Main HTML (contains visualization divs)
├── css/
│   ├── style.css           # Global/shared styles
│   └── globeVis.css        # Globe-specific styles (prefix: globe-)
├── js/
│   ├── main.js             # Entry point, initializes visualizations
│   └── globeVis.js         # Globe visualization class
├── data/
│   └── deforestation.csv   # Deforestation data by region
└── README.md
```

## Adding New Visualizations

Each visualization should:
1. Have its own `.js` file in `js/` folder
2. Have its own `.css` file in `css/` folder
3. Use unique CSS class prefixes (e.g., `globe-`, `chart-`, `map-`)
4. Be contained in a specific `<div>` block in `index.html`
5. Load data from `data/` folder

## Data Format

`data/deforestation.csv`:
```csv
region,lat,lon,year,forestCover,birdSpecies
Amazon,-3.4653,-62.2159,2000,100,1300
...
```

## Running Locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000

## CSS Class Naming

All globe classes use `globe-` prefix:
- `.globe-container`
- `.globe-hotspot`
- `.globe-popup`
- `.globe-visible`
- etc.
