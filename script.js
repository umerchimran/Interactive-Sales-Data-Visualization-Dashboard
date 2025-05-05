
// Global state for filtering and persistence
const dashboardState = {
    activeFilters: {},
    savedSettings: {},
};

let globalData = [];

function loadData() {
    d3.csv('http://localhost/tb-dashboard/TB_Data.csv').then((data) => {
        globalData = data;
        populateFilters(data);
        updateVisualizations(data);
    });
}

function populateFilters(data) {
    const regionFilter = document.getElementById("regionFilter");         // adding filters by region and year
    const yearFilter = document.getElementById("yearFilter");

    const uniqueRegions = [...new Set(data.map((d) => d.region))];
    const uniqueYears = [...new Set(data.map((d) => d.year))].sort();

    uniqueRegions.forEach((region) => {
        const option = document.createElement("option");
        option.value = region;
        option.textContent = region;
        regionFilter.appendChild(option);
    });

    uniqueYears.forEach((year) => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });

    regionFilter.addEventListener("change", filterData);
    yearFilter.addEventListener("change", filterData);
}

function filterData() {                // filter function
    const regionFilter = document.getElementById("regionFilter").value;
    const yearFilter = document.getElementById("yearFilter").value;

    const filteredData = globalData.filter(
        (d) =>
            (!regionFilter || d.region === regionFilter) &&
            (!yearFilter || d.year === yearFilter)
    );

    updateVisualizations(filteredData);
}

function updateVisualizations(data) {
    d3.selectAll("#map-chart svg").remove();
    d3.selectAll("#sunburst svg").remove();
    d3.selectAll("#force-graph svg").remove();
    d3.selectAll("#timeline svg").remove();
    d3.selectAll("#tree-map svg").remove();

    createMapChart(data);
    createSunburstChart(data);
    createForceDirectedGraph(data);
    createTimelineVisualization(data);
    createTreeMap(data);
}

// Utility function for color generation
function generateColors(count) {
    const colors = [
        "#FF6B6B",
        "#4ECDC4",
        "#45B7D1",
        "#FDCB6E",
        "#6C5CE7",
        "#A8E6CF",
        "#FF8ED4",
        "#FAD390",
    ];
    return colors.slice(0, count);
}

function saveDashboardState() {
    localStorage.setItem("dashboardState", JSON.stringify(dashboardState));
}

function loadDashboardState() {
    const savedState = localStorage.getItem("dashboardState");
    if (savedState) {
        Object.assign(dashboardState, JSON.parse(savedState));
    }
}

//Force Directed Graph
function createForceDirectedGraph(data) {
    const width = 1200,
        height = 600;

    const svg = d3
        .select("#force-graph")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Tooltip creation
    const tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background-color", "rgba(0, 0, 0, 0.7)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "5px")
        .style("font-size", "12px");

    // Preprocess data to create nodes
    const regionNodes = [...new Set(data.map((d) => d.region))].map((region) => ({
        id: region,
        type: "region",
    }));

    const countryNodes = [...new Set(data.map((d) => d.country))].map((country) => ({
        id: country,
        type: "country",
        total_population: country.total_population,
        recovery_rate: country.recovery_rate,
        economic_impact: country.economic_impact,
        cases_per_100k: country.cases_per_100k,
        total_cases: country.total_cases,
    }));

    const nodes = [...regionNodes, ...countryNodes];

    // Create links based on country-to-region relationship
    const links = data.map((d) => ({
        source: d.country,
        target: d.region,
        value: +d.total_cases, // Example metric to show as the link value
    }));

    // Color scale for different node types
    const colorScale = d3
        .scaleOrdinal()
        .domain(["region", "country"])
        .range(["#FF6B6B", "#4ECDC4"]);

    const simulation = d3
        .forceSimulation(nodes)
        .force(
            "link",
            d3
                .forceLink(links)
                .id((d) => d.id)
                .distance(100)
        )
        .force("charge", d3.forceManyBody().strength(-7))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg
        .append("g")
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .attr("stroke", "#aaa")
        .attr("stroke-opacity", 0.2)
        .attr("stroke-width", 1)
        .on("mouseover", function (event, d) {
            d3.select(this).attr("stroke-opacity", 0.7); // Highlight the link on hover
            tooltip
                .style("visibility", "visible")
                .html(
                    `<strong>Total Cases:</strong> ${d.value}<br/><strong>Region:</strong> ${d.target}<br/><strong>Country:</strong> ${d.source}`
                )
                .style("left", event.pageX + 10 + "px")
                .style("top", event.pageY - 30 + "px");
        })
        .on("mouseout", function () {
            d3.select(this).attr("stroke-opacity", 0.2); // Reset link opacity
            tooltip.style("visibility", "hidden");
        });

    const node = svg
        .append("g")
        .selectAll("circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("r", (d) => (d.type === "region" ? 10 : 4))
        .attr("fill", (d) => colorScale(d.type))
        .call(
            d3
                .drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended)
        );

    // Add labels
    const labels = svg
        .append("g")
        .selectAll("text")
        .data(nodes)
        .enter()
        .append("text")
        .text((d) => d.id)
        .attr("font-size", 10)
        .attr("dx", 12)
        .attr("dy", 4);

    simulation.on("tick", () => {
        link
            .attr("x1", (d) => d.source.x)
            .attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x)
            .attr("y2", (d) => d.target.y);

        node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

        labels.attr("x", (d) => d.x).attr("y", (d) => d.y);
    });

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}
// Enhanced Map Chart Visualization
function createMapChart(data) {
    const width = 600,
        height = 400;

    // Create SVG
    const svg = d3
        .select("#map-chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const tooltip = d3.select("#tooltip");

    const projection = d3
        .geoMercator()
        .scale(150)
        .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Load world map data
    d3.json(
        "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
    ).then((worldData) => {
        // Draw countries
        svg
            .append("g")
            .selectAll("path")
            .data(
                topojson.feature(worldData, worldData.objects.countries).features
            )
            .enter()
            .append("path")
            .attr("d", path)
            .attr("fill", "#E0E0E0")
            .attr("stroke", "#FFFFFF")
            .attr("stroke-width", 0.5);

        // Map data to countries
        const maxCases = d3.max(data, (d) => +d.total_cases || 0);
        const colorScale = d3
            .scaleSequential(d3.interpolateReds)
            .domain([0, maxCases]);

        svg
            .append("g")
            .selectAll("path")
            .data(
                topojson.feature(worldData, worldData.objects.countries).features
            )
            .enter()
            .append("path")
            .attr("d", path)
            .attr("fill", (d) => {
                const countryData = data.find(
                    (dataPoint) => dataPoint.country === d.properties.name
                );
                return countryData
                    ? colorScale(+countryData.total_cases || 0)
                    : "#E0E0E0"; // Default to light gray for countries with no data
            })
            .attr("stroke", "#FFFFFF")
            .attr("stroke-width", 0.5)
            .on("mouseover", function (event, d) {
                const countryData = data.find(
                    (dataPoint) => dataPoint.country === d.properties.name
                );
                d3.select(this).attr("opacity", 1);
                tooltip
                    .style("display", "block")
                    .html(
                        `
    <strong>${d.properties.name}</strong><br>
    Region: ${countryData ? countryData.region : "N/A"}<br>
    Total Cases: ${countryData ? (+countryData.total_cases || 0).toLocaleString() : "N/A"}<br>
    Cases Per 100k: ${countryData ? (+countryData.cases_per_100k || 0).toLocaleString() : "N/A"}<br>
    Recovery Rate: ${countryData ? (+countryData.recovery_rate || 0).toLocaleString() : "N/A"}%<br>
    Economic Impact: ${countryData ? countryData.economic_impact : "N/A"}<br>
    Severity: ${countryData ? countryData.case_severity : "N/A"}
            `
                    )
                    .style("left", event.pageX + 10 + "px")
                    .style("top", event.pageY - 10 + "px");
            })
            .on("mouseout", function () {
                d3.select(this).attr("opacity", 0.8);
                tooltip.style("display", "none");
            });

        // Zoom functionality
        const zoom = d3
            .zoom()
            .scaleExtent([1, 8])
            .on("zoom", (event) => {
                svg.selectAll("path").attr("transform", event.transform);
            });

        svg.call(zoom);

        // Legend
        const legendWidth = 300;
        const legendHeight = 20;

        const legend = svg
            .append("g")
            .attr(
                "transform",
                `translate(${width - legendWidth - 20},${height - 60})`
            );

        const legendScale = d3
            .scaleLinear()
            .domain([0, maxCases])
            .range([0, legendWidth]);

        const gradient = legend
            .append("defs")
            .append("linearGradient")
            .attr("id", "gradient")
            .attr("x1", "0%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "0%");

        gradient
            .append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "#FFEBEB"); // Light red
        gradient
            .append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "#B20000"); // Dark red

        legend
            .append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#gradient)");

        // Legend axis
        const axis = d3
            .axisBottom(legendScale)
            .ticks(5)
            .tickFormat(d3.format(".0s"));

        legend
            .append("g")
            .attr("transform", `translate(0,${legendHeight})`)
            .call(axis);
    });
}


// Sunburst Chart Visualization
function createSunburstChart(data) {
    const width = 350,
        height = 350;
    const radius = Math.min(width, height) / 2;

    const svg = d3
        .select("#sunburst")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    // Hierarchical data preparation
    const hierarchyData = d3.rollup(
        data,
        (v) => d3.sum(v, (d) => +d.total_cases), // Sum total cases
        (d) => d.region, // First level: region
        (d) => d.country // Second level: country
    );

    const root = d3
        .hierarchy({
            name: "TB Cases",
            children: Array.from(hierarchyData, ([region, countries]) => ({
                name: region,
                children: Array.from(countries, ([country, value]) => ({
                    name: country,
                    value: value,
                })),
            })),
        })
        .sum((d) => d.value || 0);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const partition = d3.partition().size([2 * Math.PI, radius]);

    partition(root);

    const arc = d3
        .arc()
        .startAngle((d) => d.x0)
        .endAngle((d) => d.x1)
        .innerRadius((d) => d.y0)
        .outerRadius((d) => d.y1);

    svg
        .selectAll("path")
        .data(root.descendants())
        .enter()
        .append("path")
        .attr("display", (d) => (d.depth ? null : "none"))
        .attr("d", arc)
        .style("stroke", "#fff")
        .style("fill", (d) => color((d.children ? d : d.parent).data.name))
        .on("mouseover", function (event, d) {
            const countryData = data.find(
                (dataPoint) => dataPoint.country === d.data.country
            );
            d3.select("#tooltip")
                .style("display", "block")
                .html(`
                    <strong>${d.data.name}</strong><br>
                    Total Cases: ${d.value.toLocaleString()}<br>
                    Region: ${d.parent ? d.parent.data.name : "N/A"}<br>
                    Population: ${countryData ? countryData.total_population.toLocaleString() : "N/A"}<br>
                    Recovery Rate: ${countryData ? countryData.recovery_rate : "N/A"}<br>
                    Cases per 100k: ${countryData ? countryData.cases_per_100k : "N/A"}<br>
                    Economic Impact: ${countryData ? countryData.economic_impact : "N/A"}
                `)
                .style("left", event.pageX + 10 + "px")
                .style("top", event.pageY - 10 + "px");
        })
        .on("mouseout", () => {
            d3.select("#tooltip").style("display", "none");
        })
        .on("click", function (event, d) {
            svg
                .transition()
                .duration(750)
                .tween("scale", () => {
                    const xd = d3.interpolate(arc.startAngle()(), d.x0);
                    const yd = d3.interpolate(arc.endAngle()(), d.x1);
                    const yr = d3.interpolate(arc.innerRadius()(), d.y0);
                    const yR = d3.interpolate(arc.outerRadius()(), d.y1);
                    return (t) => {
                        d3.select(this).attr(
                            "d",
                            arc
                                .startAngle(xd(t))
                                .endAngle(yd(t))
                                .innerRadius(yr(t))
                                .outerRadius(yR(t))
                        );
                    };
                });
        });
}
//Time Line Visualization Chart

function createTimelineVisualization(data) {
    const width = 450,
        height = 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };

    const svg = d3
        .select("#timeline")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Group data by year and calculate total new cases and recovery rate
    const groupedData = d3.group(data, (d) => d.year);
    const yearlyData = Array.from(groupedData, ([year, values]) => {
        const totalCases = d3.sum(values, (d) => +d.total_cases); // Sum of total_cases
        const avgRecoveryRate = d3.mean(values, (d) => +d.recovery_rate); // Average recovery_rate per year
        return {
            year: +year,
            total_cases: totalCases,
            recovery_rate: avgRecoveryRate,
        };
    }).sort((a, b) => a.year - b.year);

    const x = d3
        .scaleLinear()
        .domain(d3.extent(yearlyData, (d) => d.year))
        .range([0, width]);

    const y = d3
        .scaleLinear()
        .domain([0, d3.max(yearlyData, (d) => d.total_cases)])
        .range([height, 0]);

    // Create line generator for total_cases
    const line = d3
        .line()
        .x((d) => x(d.year))
        .y((d) => y(d.total_cases));

    // Create line generator for recovery_rate (secondary line)
    const recoveryLine = d3
        .line()
        .x((d) => x(d.year))
        .y((d) => y(d.recovery_rate));

    // Add x-axis
    svg
        .append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    // Add y-axis
    svg.append("g").call(d3.axisLeft(y));

    // Add line path for total_cases
    svg
        .append("path")
        .datum(yearlyData)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2)
        .attr("d", line);

    // Add line path for recovery_rate (secondary line)
    svg
        .append("path")
        .datum(yearlyData)
        .attr("fill", "none")
        .attr("stroke", "green")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5") // Dashed line for recovery_rate
        .attr("d", recoveryLine);

    // Add circles for total_cases
    svg
        .selectAll("circle.total-cases")
        .data(yearlyData)
        .enter()
        .append("circle")
        .attr("class", "total-cases")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.total_cases))
        .attr("r", 5)
        .attr("fill", "steelblue")
        .on("mouseover", function (event, d) {
            d3.select("#tooltip")
                .style("display", "block")
                .html(
                    `Year: ${d.year}<br>Total Cases: ${d.total_cases.toLocaleString()}`
                )
                .style("left", event.pageX + 10 + "px")
                .style("top", event.pageY - 10 + "px");
        })
        .on("mouseout", () => {
            d3.select("#tooltip").style("display", "none");
        });

    // Add circles for recovery_rate
    svg
        .selectAll("circle.recovery-rate")
        .data(yearlyData)
        .enter()
        .append("circle")
        .attr("class", "recovery-rate")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.recovery_rate))
        .attr("r", 5)
        .attr("fill", "green")
        .on("mouseover", function (event, d) {
            d3.select("#tooltip")
                .style("display", "block")
                .html(
                    `Year: ${d.year}<br>Recovery Rate: ${d.recovery_rate.toFixed(2)}%`
                )
                .style("left", event.pageX + 10 + "px")
                .style("top", event.pageY - 10 + "px");
        })
        .on("mouseout", () => {
            d3.select("#tooltip").style("display", "none");
        });
}
// TreeMap
function createTreeMap(data) {
    const width = 950,
        height = 450;

    const hierarchyData = {
        name: "TB Cases",
        children: Array.from(
            d3.group(data, (d) => d.region).entries(),  // Group by region
            ([region, values]) => ({
                name: region,
                children: Array.from(
                    d3.group(values, (d) => d.country).entries(),  // Group by country within region
                    ([country, cases]) => ({
                        name: country,
                        value: d3.sum(cases, (d) => +d.total_cases || 0),  // Sum total cases for each country
                        population: cases[0].total_population,  // Assuming population is consistent for a country
                        recovery_rate: cases[0].recovery_rate, // Recovery rate
                        economic_impact: cases[0].economic_impact // Economic impact
                    })
                ),
            })
        ),
    };

    const root = d3.hierarchy(hierarchyData).sum((d) => d.value || 0);
    const treemapLayout = d3.treemap().size([width, height]).padding(2);
    treemapLayout(root);

    const svg = d3
        .select("#tree-map")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    const cell = svg
        .selectAll("g")
        .data(root.leaves())
        .enter()
        .append("g")
        .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

    // Add rectangles for each cell in the treemap
    cell
        .append("rect")
        .attr("width", (d) => d.x1 - d.x0)
        .attr("height", (d) => d.y1 - d.y0)
        .attr("fill", (d) => colorScale(d.parent.data.name));

    // Add text labels to each cell
    cell
        .append("text")
        .attr("x", 5)
        .attr("y", 15)
        .text((d) => `${d.data.name}: ${d.value.toLocaleString()}`)
        .attr("font-size", "10px")
        .attr("fill", "white");

    // Create a tooltip div
    const tooltip = d3.select("body").append("div")
        .attr("id", "tooltip")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background-color", "rgba(0,0,0,0.7)")
        .style("color", "white")
        .style("border-radius", "5px")
        .style("padding", "10px")
        .style("visibility", "hidden"); // Initially hidden

    // Add hover interaction for tooltips
    cell
        .on("mouseover", function (event, d) {
            // Highlight the hovered cell
            d3.select(this).select("rect").attr("opacity", 0.8);

            // Ensure the tooltip is visible
            tooltip.style("visibility", "visible")
                .html(
                    `
                    <strong>${d.data.name}</strong><br>
                    Total Cases: ${d.value.toLocaleString()}<br>
                    Region: ${d.parent.data.name}<br>
                    Population: ${d.data.population.toLocaleString()}<br>
                    Recovery Rate: ${d.data.recovery_rate}%<br>
                    Economic Impact: ${d.data.economic_impact}<br>
                    `
                )
                // Position the tooltip near the mouse pointer with a slight offset
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 30) + "px");
        })
        .on("mouseout", function () {
            // Reset the highlight
            d3.select(this).select("rect").attr("opacity", 1);
            tooltip.style("visibility", "hidden");  // Hide the tooltip
        });
}



loadData();

function addExportFunctionality() {
    document.getElementById("export-view").addEventListener("click", () => {
        const svgElements = document.querySelectorAll("svg");
        svgElements.forEach((svg) => {
            const serializer = new XMLSerializer();
            const svgBlob = new Blob([serializer.serializeToString(svg)], {
                type: "image/svg+xml;charset=utf-8",
            });
            const url = URL.createObjectURL(svgBlob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "dashboard-view.svg";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    });
}