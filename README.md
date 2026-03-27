# The Trees Presents: Our Warming World

## Project Overview

Our Warming World is an interactive data-visualization project about climate change and ecological loss. 
Instead of presenting one chart in isolation, it combines multiple visual stories into a single experience: global warming over time, country-level emissions, deforestation hotspots, and biodiversity risk.

The goal is to make long-term environmental change easier to understand, compare, and remember.

## Why This Project

Climate and biodiversity data are often large, technical, and difficult to connect across topics.  
This project was built to answer a simple question:

How do temperature rise, emissions, forest loss, and species risk relate when viewed together?

By placing these views side by side in one interface, the project helps users move from global patterns to regional detail without losing context.

## What It Does

The experience includes four complementary visualizations:

- A temperature spiral that highlights long-run warming trends.
- A rotating globe with deforestation hotspots, where each hotspot opens a historical trend view.
- A country-based emissions view for comparing scale and distribution.
- A forest-loss and bird-risk scene that ties ecological decline to changing risk levels over time.

Each view focuses on a different part of the climate story, but together they present one narrative: environmental systems are connected, and the effects are cumulative.

## How It Works (High Level)

- The project runs as a static web page.
- Data is loaded from CSV sources and rendered client-side.
- Interactions (hover, click, drag, slider input) update the visuals in place.
- Geographic rendering uses D3 map projections and world geometry for context.

No backend service is required for normal use.

## User Guide

Visit the hosted website at [calebji.com/The-Trees](https://calebji.com/The-Trees/)

1. Open the project in a browser.
2. Start with the temperature view to understand the historical baseline.
3. Move to the globe and click hotspots to inspect deforestation severity and trend details.
4. Compare country-level emissions to see geographic imbalance.
5. Use the forest/risk view to connect land-use decline with biodiversity pressure.

Recommended reading flow: global trend -> regional hotspot -> country comparison -> ecological outcome.

## Outcome

By the end of the walkthrough, users should be able to:

- identify where change is accelerating,
- compare severity across regions,
- connect emissions and land-use pressure to biodiversity risk,
- and explain climate change as a linked system rather than separate issues.

