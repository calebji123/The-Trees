
const body = d3.select("body");

const names = Object.keys(vizInfo)
const svgs = new Map(names.map(k => [k, null]))

let name, info;
for (var i = 0; i < 5; i++) {
    name = names[i];
    info = vizInfo[name];

    svgs[name] = body.append("div")
        .append("svg")
        .attr("height", info.height)
        .attr("width", info.width)
}


