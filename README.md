# The Trees - Deforestation Globe Visualization

A D3.js visualization showing global deforestation hotspots.

## Project Structure

```
The-Trees/
├── globe.html          # Main globe visualization
├── css/
│   └── style.css       # Styling
├── js/
│   └── main.js         # JavaScript
└── README.md
```

## Features

- Interactive 3D rotating globe
- Deforestation hotspots with severity indicators
- Drag to rotate
- Hover for regional details
- Auto-rotation when idle

## Data

Regions tracked:
- Amazon (30% forest loss)
- Congo Basin (23% forest loss)
- Southeast Asia (45% forest loss)
- Central America (28% forest loss)
- Madagascar (43% forest loss)

## To Run

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/globe.html

## Technology

- D3.js v7
- TopoJSON for world map
