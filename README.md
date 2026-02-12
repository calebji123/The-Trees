# The Trees - Deforestation Globe

Interactive D3.js globe showing global deforestation hotspots.

## Structure

```
The-Trees/
├── index.html
├── css/
│   ├── style.css        # Global styles
│   └── globeVis.css     # Globe styles (prefix: globe-)
├── js/
│   ├── main.js          # Entry point
│   └── globeVis.js      # Globe class
└── data/
    └── deforestation.csv
```

## Run

```bash
python3 -m http.server 8000
```

Open http://localhost:8000

## Usage

- Drag to rotate globe
- Click hotspot to see chart
