/*
 * Copyright (c) 2016, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

var fromDate;
var toDate;

var currentDay = new Date();
var startDate = new Date(currentDay.getTime() - (60 * 60 * 24 * 100));
var endDate = new Date(currentDay.getTime());

var groupId;

var color = ['#c05020', '#30c020', '#6060c0', '#170B3B', '#5E610B', '#2F0B3A', '#FF4000', '#2F0B3A', 'steelblue'];
var stats;

// create a custom bar renderer that shift bars
Rickshaw.Graph.Renderer.BinaryBar = Rickshaw.Class.create(Rickshaw.Graph.Renderer.Bar, {
    name: 'binary_bar',
    render: function (args) {

        args = args || {};

        var graph = this.graph;
        var series = args.series || graph.series;

        var vis = args.vis || graph.vis;
        vis.selectAll('*').remove();

        var barWidth = this.barWidth(series.active()[0]);
        var barXOffset = 0;

        var activeSeriesCount = series.filter(function (s) {
            return !s.disabled;
        }).length;
        var seriesBarWidth = this.unstack ? barWidth / activeSeriesCount : barWidth;

        var transform = function (d) {
            // add a matrix transform for negative values
            var matrix = [1, 0, 0, (d.y < 0 ? -1 : 1), 0, (d.y < 0 ? graph.y.magnitude(Math.abs(d.y)) * 2 : 0)];
            return "matrix(" + matrix.join(',') + ")";
        };

        var index = 0;
        series.forEach(function (series) {
            if (series.disabled) return;

            var nodes = vis.selectAll("path")
                .data(series.stack.filter(function (d) {
                    return d.y !== null
                }))
                .enter().append("svg:rect")
                .attr("x", function (d) {
                    return graph.x(d.x) + barXOffset
                })
                .attr("y", function (d) {
                    return ((graph.y(index + Math.abs(d.y))) * (d.y < 0 ? -1 : 1 ))
                })
                .attr("width", seriesBarWidth)
                .attr("height", function (d) {
                    return graph.y.magnitude(Math.abs(d.y))
                })
                .attr("transform", transform);

            index++;
            Array.prototype.forEach.call(nodes[0], function (n) {
                n.setAttribute('fill', series.color);
            });

            if (this.unstack) barXOffset += seriesBarWidth;

        }, this);
    }
});

function initDate() {
    currentDay = new Date();
}

var configObject = {
    startOfWeek: 'monday',
    separator: ' to ',
    format: 'YYYY-MM-DD HH:mm',
    autoClose: false,
    time: {
        enabled: true
    },
    shortcuts: 'hide',
    endDate: currentDay,
    maxDays: 2,
    getValue: function () {
        return this.value;
    },
    setValue: function (s) {
        this.value = s;
    }
};

var DateRange = convertDate(startDate) + " " + configObject.separator + " " + convertDate(endDate);

$(document).ready(function () {
    initDate();
    groupId = getQueryParams().groupId;

    $('#date-range').html(DateRange);
    $('#date-range').dateRangePicker(configObject)
        .bind('datepicker-apply', function (event, dateRange) {
            $(this).addClass('active');
            $(this).siblings().removeClass('active');
            fromDate = dateRange.date1 != "Invalid Date" ? dateRange.date1.getTime() / 1000 : null;
            toDate = dateRange.date2 != "Invalid Date" ? dateRange.date2.getTime() / 1000 : null;
            getStats(fromDate, toDate);
        }
    );
    getDateTime(currentDay.getTime() - 3600000, currentDay.getTime());
    $('#hour-btn').addClass('active');
});

//hour
$('#hour-btn').on('click', function () {
    initDate();
    getDateTime(currentDay.getTime() - 3600000, currentDay.getTime());
});

//12 hours
$('#h12-btn').on('click', function () {
    initDate();
    getDateTime(currentDay.getTime() - (3600000 * 12), currentDay.getTime());
});

//24 hours
$('#h24-btn').on('click', function () {
    initDate();
    getDateTime(currentDay.getTime() - (3600000 * 24), currentDay.getTime());
});

//48 hours
$('#h48-btn').on('click', function () {
    initDate();
    getDateTime(currentDay.getTime() - (3600000 * 48), currentDay.getTime());
});

$('body').on('click', '.btn-group button', function (e) {
    $(this).addClass('active');
    $(this).siblings().removeClass('active');
});

function getDateTime(from, to) {
    fromDate = from;
    toDate = to;
    startDate = new Date(from);
    endDate = new Date(to);
    DateRange = convertDate(startDate) + " " + configObject.separator + " " + convertDate(endDate);
    console.log(DateRange);
    $('#date-range').html(DateRange);
    getStats(from / 1000, to / 1000);
}

function getStats(from, to) {
    $('#div-chart').html('<div style="height:200px" data-state="loading" data-loading-text="Loading..." data-loading-style="icon-only" data-loading-inverse="true"></div>');
    var requestData = {};
    var getStatsRequest;
    if (from) {
        requestData['from'] = parseInt(from);
    }
    if (to) {
        requestData['to'] = parseInt(to);
    }
    if (groupId && groupId != "0") {
        requestData['groupId'] = groupId;
        getStatsRequest = $.ajax({
            url: "api/stats/group",
            method: "GET",
            data: requestData
        });
    } else {
        var deviceId = getQueryParams().deviceId;
        var deviceType = getQueryParams().deviceType;

        requestData['deviceId'] = deviceId;
        requestData['deviceType'] = deviceType;

        getStatsRequest = $.ajax({
            url: "api/stats",
            method: "GET",
            data: requestData
        });
    }
    getStatsRequest.done(function (data) {
        stats = data;
        updateGraphs();
    });

    getStatsRequest.fail(function (jqXHR, textStatus) {
        console.log("Request failed: " + jqXHR.statusText);
    });
}

$(window).on('resize', function(){
    if (stats){
        updateGraphs();
    }
});

function updateGraphs() {
    console.log(stats);
    var graphId = 1;
    $('#div-chart').html("");
    for (var stats_data in stats){
        switch (stats[stats_data][0]["stream"]["ui_unit"]["name"]){
            case "cdmf.unit.analytics.line-chart":
                $('#div-chart').append("<div class='row margin-double shrink'><div><h2 class='grey'>" + stats[stats_data][0]["stream"]["name"] + "</h2><hr><div id='canvas-wrapper" + graphId + "'></div></div><hr class='spaced'></div>");
                drawLineGraph(graphId++, stats[stats_data]);
                break;
            case "cdmf.unit.analytics.bar-chart":
                $('#div-chart').append("<div class='row margin-double shrink'><div><h2 class='grey'>" + stats[stats_data][0]["stream"]["name"] + "</h2><hr><div id='canvas-wrapper" + graphId + "'></div></div><hr class='spaced'></div>");
                drawBarGraph(graphId++, stats[stats_data]);
                break;
        }
    }
    scaleGraphs();
}

function drawLineGraph(graphId, chartDataRaw) {
    var chartWrapperElmId = "#canvas-wrapper" + graphId;
    var graphWidth = $(chartWrapperElmId).width() - 50;
    if (chartDataRaw.length == 0) {
        $(chartWrapperElmId).html("No data available...");
        return;
    }

    var chartDiv = "chart" + graphId;
    var sliderDiv = "slider" + graphId;
    var y_axis = "y_axis" + graphId;
    $(chartWrapperElmId).html("").html('<div id = "' + y_axis
        + '" class="custom_y_axis"></div><div class="legend_container" id="legend_container'
        + graphId + '"><div id="smoother' + graphId + '" title="Smoothing"></div><div class="legend" id="legend'
        + graphId + '"></div></div><div id="' + chartDiv
        + '" class="custom_rickshaw_graph"></div><div class="custom_x_axis"></div><div id="' + sliderDiv
        + '" class="custom_slider"></div>');

    var graphConfig = {
        element: document.getElementById(chartDiv),
        width: graphWidth,
        height: 400,
        strokeWidth: 2,
        renderer: 'line',
        unstack: true,
        stack: false,
        xScale: d3.time.scale(),
        padding: {top: 0.2, left: 0.02, right: 0.02, bottom: 0.2},
        series: []
    };

    var k = 0;
    var min = Number.MAX_VALUE;
    var max = Number.MIN_VALUE;
    var range_min = 99999, range_max = 0;
    for (var i = 0; i < chartDataRaw.length; i++) {
        var chartData = [];
        if (chartDataRaw[i].stats.length > 0) {
            var max_val = parseInt(chartDataRaw[i].stats[0].value);
            var min_val = max_val;
            for (var j = 0; j < chartDataRaw[i].stats.length; j++) {
                var y_val = parseInt(chartDataRaw[i].stats[j].value);
                if (y_val > max_val) {
                    max_val = y_val;
                } else if (y_val < min_val) {
                    min_val = y_val;
                }
                chartData.push({
                    x: parseInt(chartDataRaw[i].stats[j].time),
                    y: y_val
                });
            }
            if (range_max < max_val) {
                range_max = max_val;
            }
            if (range_min > min_val) {
                range_min = min_val;
            }
            graphConfig['series'].push({
                'color': color[k],
                'data': summerizeLine(chartData),
                'name': chartDataRaw[i].device,
                'scale': d3.scale.linear().domain([Math.min(min, min_val) - 5, Math.max(max, max_val) + 5]).nice()
            });
        }
        if (++k == color.length) {
            k = 0;
        }
    }

    if (graphConfig['series'].length == 0) {
        $(chartWrapperElmId).html("No data available...");
        return;
    }

    var graph = new Rickshaw.Graph(graphConfig);

    graph.render();

    var xAxis = new Rickshaw.Graph.Axis.Time({
        graph: graph
    });

    xAxis.render();

    var yAxis = new Rickshaw.Graph.Axis.Y.Scaled({
        graph: graph,
        orientation: 'left',
        element: document.getElementById(y_axis),
        width: 40,
        height: 410,
        'scale': d3.scale.linear().domain([Math.min(min, range_min), Math.max(max, range_max)]).nice()
    });

    yAxis.render();

    var slider = new Rickshaw.Graph.RangeSlider.Preview({
        graph: graph,
        element: document.getElementById(sliderDiv)
    });

    var legend = new Rickshaw.Graph.Legend({
        graph: graph,
        element: document.getElementById('legend' + graphId)
    });

    var hoverDetail = new Rickshaw.Graph.HoverDetail({
        graph: graph
    });

    var shelving = new Rickshaw.Graph.Behavior.Series.Toggle({
        graph: graph,
        legend: legend
    });

    var order = new Rickshaw.Graph.Behavior.Series.Order({
        graph: graph,
        legend: legend
    });

    var highlighter = new Rickshaw.Graph.Behavior.Series.Highlight({
        graph: graph,
        legend: legend
    });
}


function drawBarGraph(graphId, chartDataRaw) {
    var chartWrapperElmId = "#canvas-wrapper" + graphId;
    var graphWidth = $(chartWrapperElmId).width() - 50;
    if (chartDataRaw.length == 0) {
        $(chartWrapperElmId).html("No data available...");
        return;
    }

    var chartDiv = "chart" + graphId;
    var sliderDiv = "slider" + graphId;
    var y_axis = "y_axis" + graphId;
    $(chartWrapperElmId).html("").html('<div id = "' + y_axis
        + '" class="custom_y_axis"></div><div class="legend_container" id="legend_container'
        + graphId + '"><div id="smoother' + graphId + '" title="Smoothing"></div><div class="legend" id="legend'
        + graphId + '"></div></div><div id="' + chartDiv
        + '" class="custom_rickshaw_graph"></div><div class="custom_x_axis"></div><div id="' + sliderDiv
        + '" class="custom_slider"></div>');

    var graphConfig = {
        element: document.getElementById(chartDiv),
        width: graphWidth,
        height: 50 * chartDataRaw.length,
        strokeWidth: 0.5,
        renderer: 'binary_bar',
        offset: 'zero',
        xScale: d3.time.scale(),
        padding: {top: 0.2, left: 0.0, right: 0.0, bottom: 0.2},
        series: []
    };

    var k = 0;
    for (var i = 0; i < chartDataRaw.length; i++) {
        var chartData = [];
        if (chartDataRaw[i].stats.length > 0) {
            for (var j = 0; j < chartDataRaw[i].stats.length; j++) {
                chartData.push({
                    x: parseInt(chartDataRaw[i].stats[j].time),
                    y: parseInt(chartDataRaw[i].stats[j].value > 0 ? 1 : 0)
                });
            }
            graphConfig['series'].push({
                'color': color[k],
                'data': summerizeBar(chartData),
                'name': chartDataRaw[i].device
            });
        }
        if (++k == color.length) {
            k = 0;
        }
    }

    if (graphConfig['series'].length == 0) {
        $(chartWrapperElmId).html("No data available...");
        return;
    }

    var graph = new Rickshaw.Graph(graphConfig);

    graph.registerRenderer(new Rickshaw.Graph.Renderer.BinaryBar({graph: graph}));

    graph.render();

    var xAxis = new Rickshaw.Graph.Axis.Time({
        graph: graph
    });

    xAxis.render();

    var yAxis = new Rickshaw.Graph.Axis.Y({
        graph: graph,
        orientation: 'left',
        element: document.getElementById(y_axis),
        width: 40,
        height: 55 * chartDataRaw.length,
        tickFormat: function (y) {
            return '';
        }
    });

    yAxis.render();

    var slider = new Rickshaw.Graph.RangeSlider.Preview({
        graph: graph,
        element: document.getElementById(sliderDiv)
    });

    var legend = new Rickshaw.Graph.Legend({
        graph: graph,
        element: document.getElementById('legend' + graphId)

    });

    var shelving = new Rickshaw.Graph.Behavior.Series.Toggle({
        graph: graph,
        legend: legend
    });

    var order = new Rickshaw.Graph.Behavior.Series.Order({
        graph: graph,
        legend: legend
    });

    var highlighter = new Rickshaw.Graph.Behavior.Series.Highlight({
        graph: graph,
        legend: legend
    });
}

function scaleGraphs() {
    var sliders = $('.right_handle');
    if (sliders.length == 0) {
        return;
    }
    var graphWidth = 0;
    for (var i = 1; i < 10; i++) {
        if ($('#canvas-wrapper' + i).length) {
            graphWidth = $('#canvas-wrapper' + i).width() - 50;
            break;
        }
    }

    if (graphWidth <= 0) {
        return;
    }

    //Scale graphs
    var sliderX = graphWidth * 60 * 60000 / (toDate - fromDate);
    if (sliderX < graphWidth) {
        // fake handle move
        if (sliderX < 50) {
            sliderX = 50;
        }
        var edown = document.createEvent("HTMLEvents");
        edown.initEvent("mousedown", true, true);
        edown.clientX = graphWidth;
        var emove = document.createEvent("HTMLEvents");
        emove.initEvent("mousemove", true, true);
        emove.clientX = sliderX;
        var eup = document.createEvent("HTMLEvents");
        eup.initEvent("mouseup", true, true);
        for (var slider in sliders) {
            sliders[slider].dispatchEvent(edown);
            document.dispatchEvent(emove);
            document.dispatchEvent(eup);
        }
    }
}

function convertDate(date) {
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hour = date.getHours();
    var minute = date.getMinutes();
    return date.getFullYear() + '-' + (('' + month).length < 2 ? '0' : '')
        + month + '-' + (('' + day).length < 2 ? '0' : '') + day + " " + (('' + hour).length < 2 ? '0' : '')
        + hour + ":" + (('' + minute).length < 2 ? '0' : '') + minute;
}

function summerizeLine(data) {
    if (data.length > 1500) {
        var nData = [];
        var i = 1;
        while (i < data.length) {
            var t_avg = (data[i - 1].x + data[i].x) / 2;
            var v_avg = (data[i - 1].y + data[i].y) / 2;
            nData.push({x: t_avg, y: v_avg});
            i += 2;
        }
        return summerizeLine(nData);
    } else {
        return data;
    }
}

function summerizeBar(data) {
    if (data.length > 1500) {
        var nData = [];
        var i = 1;
        while (i < data.length - 1) {
            var t_avg = (data[i - 1].x + data[i].x) / 2;
            var v_avg = (data[i - 1].y + data[i].y + data[i + 1].y) / 3;
            nData.push({x: t_avg, y: Math.round(v_avg)});
            i += 2;
        }
        return summerizeBar(nData);
    } else {
        return data;
    }
}

function getQueryParams() {
    var qs = document.location.search.split('+').join(' ');

    var params = {},
        tokens,
        re = /[?&]?([^=]+)=([^&]*)/g;

    while (tokens = re.exec(qs)) {
        params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    }

    return params;
}