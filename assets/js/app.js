/* 财务岗位招聘数据可视化 —— 图表脚本 */
(function () {
  'use strict';

  var D = window.DATA || {};
  var loadingEl = document.getElementById('loading');

  if (!D.meta) {
    if (loadingEl) {
      loadingEl.textContent = '数据文件加载失败：请通过网页地址（http/https）打开本页面。';
    }
    return;
  }

  var META = D.meta;
  var MONTHS = META.months;
  var MLABELS = META.monthLabels;
  var N = MONTHS.length;

  var C = ['#1d5bd6', '#12b3a0', '#f2994a', '#8b5cf6', '#eb5757', '#2d9cdb',
           '#27ae60', '#f2c94c', '#9b51e0', '#00b8d9', '#ff8a65', '#4db6ac',
           '#7e57c2', '#c0ca33', '#f06292', '#5c6bc0', '#26a69a', '#ffb300',
           '#ef5350', '#42a5f5'];

  var BAND_COLORS = ['#c7d3e6', '#9db4d6', '#6f92c6', '#4171b4', '#2f5fa3',
                     '#1d4f96', '#5b8f6f', '#9b8f4e', '#c67b3a'];

  function fmtInt(n) {
    if (n === null || n === undefined) return '—';
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmtY(n) {
    if (n === null || n === undefined) return '—';
    return fmtInt(n);
  }
  function fmtPct(n, d) {
    if (n === null || n === undefined) return '—';
    return n.toFixed(d === undefined ? 1 : d) + '%';
  }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] || 0; return s; }
  function el(id) { return document.getElementById(id); }

  var charts = [];
  function make(dom, option) {
    var c = echarts.init(dom, null, { renderer: 'canvas' });
    c.setOption(option);
    charts.push(c);
    return c;
  }
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      charts.forEach(function (c) { c.resize(); });
    }, 120);
  });

  var BASE_TEXT = { color: '#4a5a70', fontSize: 12 };
  var AXIS_LINE = { lineStyle: { color: '#e5eaf1' } };
  function axisLabel(extra) {
    var o = { color: '#8296ad', fontSize: 11 };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function gridOpt(l, r, t, b) {
    return { left: l, right: r, top: t, bottom: b, containLabel: true };
  }
  function tooltipBase(extra) {
    var o = {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,.97)',
      borderColor: '#e5eaf1',
      borderWidth: 1,
      textStyle: { color: '#16202e', fontSize: 12 },
      extraCssText: 'box-shadow:0 6px 20px rgba(16,32,56,.12);border-radius:8px;'
    };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function legendBase(extra) {
    var o = { top: 0, right: 0, itemWidth: 12, itemHeight: 8, textStyle: axisLabel() };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function areaGrad(color) {
    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: color + '55' }, { offset: 1, color: color + '05' }
    ]);
  }

  /* ---------------------------------------------------------------- KPI */
  function renderKPIs() {
    var salTotal = 0, salWeighted = 0;
    for (var i = 0; i < N; i++) {
      if (D.salary.avg[i] != null) { salWeighted += D.salary.avg[i] * D.salary.count[i]; salTotal += D.salary.count[i]; }
    }
    var overallAvg = salTotal ? salWeighted / salTotal : null;
    var peak = 0;
    for (var j = 1; j < N; j++) if (D.trend.monthCounts[j] > D.trend.monthCounts[peak]) peak = j;
    var yoyA = D.trend.monthCounts[N - 1] + D.trend.monthCounts[N - 2] + D.trend.monthCounts[N - 3];
    var yoyB = D.trend.monthCounts[2] + D.trend.monthCounts[1] + D.trend.monthCounts[0];
    var yoy = (yoyA - yoyB) / yoyB * 100;

    var items = [
      { v: fmtInt(META.total), l: '岗位记录总数（条）' },
      { v: String(META.cityCount), l: '覆盖城市（个）' },
      { v: N + ' 个月', l: META.months[0].replace('-', '.') + ' – ' + META.months[N - 1].replace('-', '.') },
      { v: '¥' + fmtInt(overallAvg), l: '平均薪资（元/月）' },
      { v: fmtInt(D.trend.monthCounts[peak]), l: '峰值月份 ' + MLABELS[peak] },
      { v: (yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%', l: '同比岗位量变化' }
    ];
    el('kpis').innerHTML = items.map(function (it) {
      return '<div class="kpi"><div class="v">' + it.v + '</div><div class="l">' + it.l + '</div></div>';
    }).join('');
  }

  /* -------------------------------------------------------- 1 岗位数量 */
  var trendChart, trendGrain = 'month', trendKind = false;

  function renderTrend() {
    var opt;
    if (trendGrain === 'month') {
      var counts = D.trend.monthCounts;
      var growth = counts.map(function (v, i) {
        if (i === 0) return null;
        return +(((v - counts[i - 1]) / counts[i - 1]) * 100).toFixed(1);
      });
      var series = [];
      if (trendKind) {
        var kinds = ['全职', '实习', '校园', '兼职/临时', '其他'];
        var seen = {};
        series = kinds.filter(function (k) { return D.trend.kindMonths[k]; }).map(function (k, i) {
          seen[k] = 1;
          return {
            name: k, type: 'bar', stack: 'k', barMaxWidth: 34,
            itemStyle: { color: C[i] },
            emphasis: { focus: 'series' },
            data: D.trend.kindMonths[k]
          };
        });
        Object.keys(D.trend.kindMonths).forEach(function (k) {
          if (seen[k]) return;
          series.push({
            name: k, type: 'bar', stack: 'k', barMaxWidth: 34,
            itemStyle: { color: C[series.length % C.length] },
            data: D.trend.kindMonths[k]
          });
        });
      } else {
        series.push({
          name: '岗位数', type: 'bar', barMaxWidth: 34,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#3b7de0' }, { offset: 1, color: '#1d5bd6' }])
          },
          data: counts
        });
      }
      if (!trendKind) {
        series.push({
          name: '环比增长', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 7,
          connectNulls: true,
          lineStyle: { width: 2, color: '#f2994a' },
          itemStyle: { color: '#f2994a' },
          data: growth,
          label: { show: true, formatter: '{c}%', fontSize: 10, color: '#a4703a', position: 'top' }
        });
      }
      opt = {
        tooltip: tooltipBase(),
        legend: legendBase({ show: trendKind }),
        grid: gridOpt(10, trendKind ? 10 : 56, 34, 6),
        xAxis: {
          type: 'category', data: MLABELS, axisLabel: axisLabel(), axisLine: AXIS_LINE,
          axisTick: { show: false }
        },
        yAxis: trendKind ? [{ type: 'value', name: '岗位数', nameTextStyle: axisLabel(), axisLabel: axisLabel({ formatter: function (v) { return v / 1000 + 'k'; } }), splitLine: { lineStyle: { color: '#f0f3f8' } } }]
          : [
            { type: 'value', name: '岗位数', nameTextStyle: axisLabel(), axisLabel: axisLabel({ formatter: function (v) { return v / 1000 + 'k'; } }), splitLine: { lineStyle: { color: '#f0f3f8' } } },
            { type: 'value', name: '环比 %', nameTextStyle: axisLabel(), axisLabel: axisLabel({ formatter: '{value}%' }), splitLine: { show: false } }
          ],
        series: series
      };
    } else {
      var dates = D.trend.dates.map(function (d) { return d.slice(2); });
      opt = {
        tooltip: tooltipBase(),
        legend: legendBase({ data: ['日岗位数', '7 日移动平均', '30 日移动平均'] }),
        grid: gridOpt(10, 10, 34, 6),
        dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 0, borderColor: '#e5eaf1', textStyle: axisLabel() }],
        xAxis: { type: 'category', data: dates, axisLabel: axisLabel({ interval: 29 }), axisLine: AXIS_LINE, axisTick: { show: false } },
        yAxis: { type: 'value', name: '岗位数', nameTextStyle: axisLabel(), axisLabel: axisLabel(), splitLine: { lineStyle: { color: '#f0f3f8' } } },
        series: [
          { name: '日岗位数', type: 'line', symbol: 'none', lineStyle: { width: 1, color: '#9db4d6' }, areaStyle: { color: areaGrad('#9db4d6') }, data: D.trend.dailyCounts },
          { name: '7 日移动平均', type: 'line', symbol: 'none', smooth: true, lineStyle: { width: 2.2, color: '#1d5bd6' }, data: D.trend.dailyMa7 },
          { name: '30 日移动平均', type: 'line', symbol: 'none', smooth: true, lineStyle: { width: 2, color: '#f2994a' }, data: D.trend.dailyMa30 }
        ]
      };
    }
    el('trend-title').textContent = trendGrain === 'month'
      ? (trendKind ? '各月岗位发布量（按岗位类别拆分）' : '各月岗位发布量与环比变化')
      : '每日岗位发布量与移动平均';
    if (!trendChart) trendChart = make(el('chart-trend'), opt);
    else trendChart.setOption(opt, true);
  }

  /* ------------------------------------------------------------ 2 城市 */
  var cityMonthIdx = 0, cityPlaying = false, cityTimer = null;
  var mapChart, rankChart, cityTrendChart, bumpChart;
  var showBubble = true;
  var TOPCITY = D.city.top.slice(0, 10);
  var provMax = 0;
  var provSeries = [];   // [monthIdx][provinceName] = count
  var cityPointSeries = []; // [monthIdx] = [[lng,lat,count,name],...]

  function buildCityMapData() {
    var idx = D.city_index;
    var names = D.city_month_full.cities;
    var matrix = D.city_month_full.matrix;
    var provNames = {};
    var i, m;
    for (i = 0; i < N; i++) { provSeries.push({}); cityPointSeries.push([]); }
    var locByIndex = new Array(names.length);
    for (i = 0; i < names.length; i++) {
      var info = idx[names[i]];
      locByIndex[i] = info || null;
      if (info && info.province) provNames[info.province] = 1;
    }
    var provList = Object.keys(provNames);
    for (i = 0; i < names.length; i++) {
      var row = matrix[i];
      var info2 = locByIndex[i];
      var lnglat = info2 && info2.center;
      for (m = 0; m < N; m++) {
        var v = row[m];
        if (!v) continue;
        if (info2 && info2.province) {
          provSeries[m][info2.province] = (provSeries[m][info2.province] || 0) + v;
        }
        if (lnglat && lnglat.length === 2) {
          cityPointSeries[m].push([lnglat[0], lnglat[1], v, names[i]]);
        }
      }
    }
    for (m = 0; m < N; m++) {
      provSeries[m] = provList.map(function (p) { return { name: p, value: provSeries[m][p] || 0 }; });
      cityPointSeries[m].sort(function (a, b) { return b[2] - a[2]; });
      cityPointSeries[m] = cityPointSeries[m].slice(0, 40);
      provSeries[m].forEach(function (d) { if (d.value > provMax) provMax = d.value; });
    }
  }

  function renderMap() {
    var m = cityMonthIdx;
    var pts = cityPointSeries[m].map(function (p) { return [p[0], p[1], p[2], p[3]]; });
    var maxCity = cityPointSeries[m].length ? cityPointSeries[m][0][2] : 1;

    var opt = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255,255,255,.97)',
        borderColor: '#e5eaf1', borderWidth: 1,
        textStyle: { color: '#16202e', fontSize: 12 },
        formatter: function (p) {
          if (p.seriesName === '省份岗位数') {
            return '<b>' + p.name + '</b><br/>岗位数：' + fmtInt(p.value || 0) + ' 条';
          }
          if (p.seriesName === '城市气泡') {
            return '<b>' + p.data[3] + '</b><br/>岗位数：' + fmtInt(p.data[2]) + ' 条';
          }
          return p.name;
        }
      },
      visualMap: {
        type: 'continuous', min: 0, max: provMax,
        left: 8, bottom: 24, calculable: true,
        itemWidth: 12, itemHeight: 110,
        text: ['高', '低'], textStyle: axisLabel(),
        inRange: { color: ['#eef4fd', '#c3d8f7', '#7fabe8', '#3f7fd4', '#1d4f96'] },
        formatter: function (v) { return fmtInt(v); }
      },
      geo: {
        map: 'china', roam: true, zoom: 1.18, center: [104, 34.5],
        label: { show: false },
        itemStyle: { areaColor: '#f2f5fa', borderColor: '#cbd6e6', borderWidth: .7 },
        emphasis: { label: { show: true, fontSize: 10 }, itemStyle: { areaColor: '#dbe7f8' } },
        select: { disabled: true }
      },
      series: [
        {
          name: '省份岗位数', type: 'map', geoIndex: 0, data: provSeries[m]
        },
        {
          name: '城市气泡', type: 'scatter', coordinateSystem: 'geo',
          data: showBubble ? pts : [], symbol: 'circle',
          symbolSize: function (val) {
            var r = Math.sqrt(val[2] / Math.max(1, maxCity));
            return 6 + 34 * r;
          },
          itemStyle: {
            color: 'rgba(242,153,74,.72)', borderColor: '#fff', borderWidth: .8,
            shadowBlur: 6, shadowColor: 'rgba(242,153,74,.5)'
          },
          emphasis: { itemStyle: { color: '#e8863a' } },
          label: {
            show: true, formatter: function (p) { return p.data[3]; },
            position: 'right', fontSize: 10, color: '#5b4a33', distance: 2
          },
          labelLayout: { hideOverlap: true },
          z: 5
        }
      ]
    };
    if (mapChart) mapChart.setOption(opt, true);
    else mapChart = make(el('chart-map'), opt);
  }

  function renderRank() {
    var m = cityMonthIdx;
    var rows = D.city.top.map(function (c, i) {
      return { name: c, value: D.city.matrix[i][m] };
    }).sort(function (a, b) { return a.value - b.value; }).slice(-10);
    var maxV = rows.length ? rows[rows.length - 1].value : 1;

    el('city-rank-title').textContent = MLABELS[m] + ' · 城市岗位数 TOP 10';
    var opt = {
      tooltip: tooltipBase({ trigger: 'item', formatter: function (p) { return p.name + '：' + fmtInt(p.value) + ' 条'; } }),
      grid: gridOpt(6, 60, 10, 6),
      xAxis: { type: 'value', max: maxV * 1.12, axisLabel: axisLabel({ formatter: function (v) { return v / 1000 + 'k'; } }), splitLine: { lineStyle: { color: '#f0f3f8' } } },
      yAxis: { type: 'category', data: rows.map(function (r) { return r.name; }), axisLabel: axisLabel({ fontSize: 12 }), axisLine: AXIS_LINE, axisTick: { show: false } },
      series: [{
        type: 'bar', barMaxWidth: 18, data: rows.map(function (r, i) {
          return {
            value: r.value,
            itemStyle: {
              borderRadius: [0, 6, 6, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: i >= 7 ? '#1d5bd6' : '#5b9bf0' },
                { offset: 1, color: i >= 7 ? '#3b7de0' : '#8fc0f7' }])
            }
          };
        }),
        label: {
          show: true, position: 'right', fontSize: 11, color: '#4a5a70',
          formatter: function (p) { return fmtInt(p.value); }
        },
        animationDuration: 500, animationDurationUpdate: 500
      }]
    };
    if (rankChart) rankChart.setOption(opt, true);
    else rankChart = make(el('chart-cityrank'), opt);
  }

  function renderCityTrend() {
    var opt = {
      tooltip: tooltipBase(),
      legend: legendBase({ type: 'scroll' }),
      grid: gridOpt(10, 18, 44, 6),
      xAxis: { type: 'category', data: MLABELS, axisLabel: axisLabel(), axisLine: AXIS_LINE, axisTick: { show: false } },
      yAxis: { type: 'value', name: '岗位数', nameTextStyle: axisLabel(), axisLabel: axisLabel(), splitLine: { lineStyle: { color: '#f0f3f8' } } },
      series: D.city.top.slice(0, 10).map(function (c, i) {
        return {
          name: c, type: 'line', smooth: true, symbolSize: 5,
          lineStyle: { width: i < 3 ? 2.6 : 1.6, color: C[i] },
          itemStyle: { color: C[i] },
          data: D.city.matrix[D.city.top.indexOf(c)]
        };
      })
    };
    cityTrendChart = make(el('chart-citytrend'), opt);
  }

  function renderBump() {
    var cities = D.city.top.slice(0, 10);
    var series = cities.map(function (c, ci) {
      var idx = D.city.top.indexOf(c);
      var data = [];
      for (var m = 0; m < N; m++) {
        var vals = D.city.top.map(function (cc, i) { return { c: cc, v: D.city.matrix[i][m] }; });
        vals.sort(function (a, b) { return b.v - a.v; });
        var rank = vals.findIndex(function (x) { return x.c === c; }) + 1;
        data.push([m, rank, D.city.matrix[idx][m]]);
      }
      return {
        name: c, type: 'line', smooth: .4, symbolSize: 8,
        lineStyle: { width: ci < 3 ? 3 : 1.8, color: C[ci] },
        itemStyle: { color: C[ci] },
        data: data,
        endLabel: { show: true, formatter: '{a}', fontSize: 11, color: C[ci], distance: 6 }
      };
    });
    var opt = {
      tooltip: tooltipBase({
        formatter: function (ps) {
          var s = MLABELS[ps[0].data[0]];
          ps.sort(function (a, b) { return a.data[1] - b.data[1]; });
          return '<b>' + s + '</b><br/>' + ps.map(function (p) {
            return p.marker + p.seriesName + '：第 ' + p.data[1] + ' 名（' + fmtInt(p.data[2]) + ' 条）';
          }).join('<br/>');
        }
      }),
      grid: gridOpt(10, 60, 20, 6),
      xAxis: { type: 'value', min: -0.4, max: N - 0.6, interval: 1, axisLabel: axisLabel({ formatter: function (v) { return MLABELS[v] ? MLABELS[v].replace('年', '/').replace('月', '') : ''; } }), splitLine: { lineStyle: { color: '#f2f5fa' } } },
      yAxis: { type: 'value', inverse: true, min: 0.5, max: 10.5, interval: 1, name: '排名', nameTextStyle: axisLabel(), axisLabel: axisLabel(), splitLine: { lineStyle: { color: '#f0f3f8' } } },
      series: series
    };
    bumpChart = make(el('chart-citybump'), opt);
  }

  function updateCity() {
    el('city-month').textContent = MLABELS[cityMonthIdx];
    renderMap();
    renderRank();
  }

  function initCity() {
    buildCityMapData();
    updateCity();
    renderCityTrend();
    renderBump();
    var slider = el('city-slider');
    slider.addEventListener('input', function () {
      cityMonthIdx = +slider.value;
      updateCity();
    });
    el('city-play').addEventListener('click', function () {
      cityPlaying = !cityPlaying;
      this.textContent = cityPlaying ? '❚❚ 暂停' : '▶ 播放';
      if (cityPlaying) {
        cityTimer = setInterval(function () {
          cityMonthIdx = (cityMonthIdx + 1) % N;
          slider.value = cityMonthIdx;
          updateCity();
        }, 1100);
      } else {
        clearInterval(cityTimer);
      }
    });
    el('city-bubble').addEventListener('change', function () {
      showBubble = this.checked;
      var opt = mapChart.getOption();
      mapChart.setOption({
        series: [
          {},
          { data: showBubble ? cityPointSeries[cityMonthIdx].map(function (p) { return [p[0], p[1], p[2], p[3]]; }) : [] }
        ]
      });
    });
  }

  /* ------------------------------------------------------------ 3 薪资 */
  var salaryChart, bandChart, salaryDimChart, salaryScope = 'all', salaryDim = 'size';

  function renderSalary() {
    var series = [];
    if (salaryScope === 'ft') {
      series.push({ name: '全部岗位平均', type: 'line', smooth: true, symbolSize: 5, lineStyle: { width: 1.6, type: 'dashed', color: '#9db4d6' }, itemStyle: { color: '#9db4d6' }, data: D.salary.avg });
      series.push({ name: '仅全职岗位平均', type: 'line', smooth: true, symbolSize: 6, lineStyle: { width: 2.8, color: '#1d5bd6' }, itemStyle: { color: '#1d5bd6' }, areaStyle: { color: areaGrad('#1d5bd6') }, data: D.salary.avgFullTime });
    } else {
      series.push({ name: 'P75', type: 'line', symbol: 'none', lineStyle: { width: 1, type: 'dotted', color: '#b9c6da' }, data: D.salary.p75 });
      series.push({ name: 'P25', type: 'line', symbol: 'none', lineStyle: { width: 1, type: 'dotted', color: '#b9c6da' }, data: D.salary.p25 });
      series.push({ name: '中位数', type: 'line', smooth: true, symbolSize: 5, lineStyle: { width: 2, color: '#12b3a0' }, itemStyle: { color: '#12b3a0' }, data: D.salary.median });
      series.push({ name: '平均薪资', type: 'line', smooth: true, symbolSize: 7, lineStyle: { width: 3, color: '#1d5bd6' }, itemStyle: { color: '#1d5bd6' }, areaStyle: { color: areaGrad('#1d5bd6') }, data: D.salary.avg });
    }
    var opt = {
      tooltip: tooltipBase({ valueFormatter: function (v) { return v == null ? '—' : fmtInt(v) + ' 元'; } }),
      legend: legendBase(),
      grid: gridOpt(10, 16, 40, 6),
      xAxis: { type: 'category', data: MLABELS, axisLabel: axisLabel(), axisLine: AXIS_LINE, axisTick: { show: false } },
      yAxis: {
        type: 'value', name: '元/月', nameTextStyle: axisLabel(),
        min: function (v) { return Math.floor((v.min - 600) / 500) * 500; },
        axisLabel: axisLabel({ formatter: function (v) { return (v / 1000).toFixed(1) + 'k'; } }),
        splitLine: { lineStyle: { color: '#f0f3f8' } }
      },
      series: series
    };
    if (salaryChart) salaryChart.setOption(opt, true);
    else salaryChart = make(el('chart-salary'), opt);
  }

  function renderBand() {
    var series = D.salary.bands.map(function (b, i) {
      return {
        name: b, type: 'line', stack: 'band', smooth: true, symbol: 'none',
        areaStyle: { opacity: .95 }, lineStyle: { width: .5, color: '#fff' },
        emphasis: { focus: 'series' },
        itemStyle: { color: BAND_COLORS[i % BAND_COLORS.length] },
        data: D.salary.bandMatrix.map(function (row) { return row[i]; })
      };
    });
    var opt = {
      tooltip: tooltipBase({
        valueFormatter: function (v) { return v == null ? '—' : (+v).toFixed(2) + '%'; }
      }),
      legend: legendBase({ type: 'scroll', top: 0, left: 0, right: 'auto', width: '70%' }),
      grid: gridOpt(10, 16, 58, 6),
      xAxis: { type: 'category', data: MLABELS, boundaryGap: false, axisLabel: axisLabel(), axisLine: AXIS_LINE, axisTick: { show: false } },
      yAxis: { type: 'value', max: 100, axisLabel: axisLabel({ formatter: '{value}%' }), splitLine: { lineStyle: { color: '#f0f3f8' } } },
      series: series
    };
    bandChart = make(el('chart-band'), opt);
  }

  function renderSalaryDim() {
    var rows = [], title = '', unit = '元/月';
    if (salaryDim === 'size') {
      title = '不同公司规模的平均薪资';
      rows = Object.keys(D.salary.bySize).filter(function (k) { return k !== '未标注'; })
        .map(function (k) { return { name: k, value: D.salary.bySize[k] }; });
    } else if (salaryDim === 'edu') {
      title = '不同学历要求的平均薪资';
      rows = Object.keys(D.salary.byEdu).map(function (k) { return { name: k, value: D.salary.byEdu[k] }; });
    } else if (salaryDim === 'exp') {
      title = '不同经验要求的平均薪资';
      rows = Object.keys(D.salary.byExp).map(function (k) { return { name: k, value: D.salary.byExp[k] }; });
    } else {
      title = '岗位量 TOP 20 城市的平均薪资';
      rows = D.city_salary.rows.slice(0, 20).map(function (r) { return { name: r.name, value: r.avg }; });
    }
    rows.sort(function (a, b) { return a.value - b.value; });
    el('salary-dim-title').textContent = title;

    var opt = {
      tooltip: tooltipBase({ trigger: 'item', valueFormatter: function (v) { return fmtInt(v) + ' 元/月'; } }),
      grid: gridOpt(6, 70, 12, 6),
      xAxis: {
        type: 'value',
        min: function (v) { return Math.floor((v.min - 500) / 500) * 500; },
        axisLabel: axisLabel({ formatter: function (v) { return (v / 1000).toFixed(0) + 'k'; } }),
        splitLine: { lineStyle: { color: '#f0f3f8' } }
      },
      yAxis: { type: 'category', data: rows.map(function (r) { return r.name; }), axisLabel: axisLabel({ fontSize: 12 }), axisLine: AXIS_LINE, axisTick: { show: false } },
      series: [{
        type: 'bar', barMaxWidth: 22,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#12b3a0' }, { offset: 1, color: '#5ad3c3' }])
        },
        data: rows.map(function (r) { return r.value; }),
        label: { show: true, position: 'right', fontSize: 11, color: '#4a5a70', formatter: function (p) { return fmtInt(p.value); } }
      }]
    };
    if (salaryDimChart) salaryDimChart.setOption(opt, true);
    else salaryDimChart = make(el('chart-salarydim'), opt);
  }

  /* --------------------------------------------------- 4/5 学历与经验 */
  function stackShareOption(src, minShare, colorStart) {
    var order = src.categories.slice().sort(function (a, b) { return src.totals[b] - src.totals[a]; });
    var keep = order.filter(function (c) {
      var avg = src.totals[c] / META.total * 100;
      return avg >= minShare;
    });
    var other = order.filter(function (c) { return keep.indexOf(c) < 0; });
    var series = keep.map(function (c, i) {
      return {
        name: c, type: 'line', stack: 's', smooth: true, symbol: 'none',
        areaStyle: { opacity: .95 }, lineStyle: { width: .5, color: '#fff' },
        emphasis: { focus: 'series' },
        itemStyle: { color: C[(i + colorStart) % C.length] },
        data: src.share[c]
      };
    });
    if (other.length) {
      var oth = [];
      for (var m = 0; m < N; m++) {
        var s = 0;
        other.forEach(function (c) { s += src.share[c][m] || 0; });
        oth.push(+s.toFixed(2));
      }
      series.push({
        name: '其他（' + other.join('、') + '）', type: 'line', stack: 's', smooth: true,
        symbol: 'none', areaStyle: { opacity: .95 }, lineStyle: { width: .5, color: '#fff' },
        itemStyle: { color: '#c7d3e6' }, data: oth
      });
    }
    return {
      tooltip: tooltipBase({ valueFormatter: function (v) { return v == null ? '—' : (+v).toFixed(2) + '%'; } }),
      legend: legendBase({ type: 'scroll', top: 0, left: 0, right: 0 }),
      grid: gridOpt(10, 16, 74, 6),
      xAxis: { type: 'category', data: MLABELS, boundaryGap: false, axisLabel: axisLabel(), axisLine: AXIS_LINE, axisTick: { show: false } },
      yAxis: { type: 'value', max: 100, axisLabel: axisLabel({ formatter: '{value}%' }), splitLine: { lineStyle: { color: '#f0f3f8' } } },
      series: series
    };
  }

  function renderEduExp() {
    var edu = D.edu_exp.edu, exp = D.edu_exp.exp, mat = D.edu_exp.matrix;
    var data = [];
    var max = 0;
    for (var i = 0; i < edu.length; i++) {
      for (var j = 0; j < exp.length; j++) {
        data.push([i, j, mat[i][j]]);
        if (mat[i][j] > max) max = mat[i][j];
      }
    }
    var opt = {
      tooltip: {
        trigger: 'item', backgroundColor: 'rgba(255,255,255,.97)', borderColor: '#e5eaf1',
        textStyle: { color: '#16202e', fontSize: 12 },
        formatter: function (p) {
          return edu[p.data[0]] + ' × ' + exp[p.data[1]] + '<br/>岗位数：' + fmtInt(p.data[2]) +
            '<br/>占比：' + (p.data[2] / META.total * 100).toFixed(2) + '%';
        }
      },
      grid: gridOpt(10, 20, 14, 60),
      xAxis: { type: 'category', data: edu, splitArea: { show: true }, axisLabel: axisLabel({ fontSize: 11 }), axisLine: AXIS_LINE, axisTick: { show: false } },
      yAxis: { type: 'category', data: exp, splitArea: { show: true }, axisLabel: axisLabel({ fontSize: 11 }), axisLine: AXIS_LINE, axisTick: { show: false } },
      visualMap: {
        min: 0, max: max, calculable: true, orient: 'horizontal', left: 'center', bottom: 4,
        itemWidth: 12, itemHeight: 90, textStyle: axisLabel(),
        inRange: { color: ['#f2f6fc', '#c3d8f7', '#7fabe8', '#3f7fd4', '#1d4f96'] }
      },
      series: [{
        type: 'heatmap', data: data,
        label: {
          show: true, fontSize: 10, color: '#fff',
          formatter: function (p) { return p.data[2] > max * 0.12 ? fmtInt(p.data[2]) : ''; }
        },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,.25)' } }
      }]
    };
    make(el('chart-eduexp'), opt);
  }

  /* ------------------------------------------------------------ 6 规模 */
  function renderSize() {
    var cats = D.size.categories.slice().sort(function (a, b) { return D.size.totals[b] - D.size.totals[a]; })
      .filter(function (c) { return c !== '未标注'; });
    var series = cats.map(function (c, i) {
      return {
        name: c, type: 'line', stack: 's', smooth: true, symbol: 'none',
        areaStyle: { opacity: .95 }, lineStyle: { width: .5, color: '#fff' },
        emphasis: { focus: 'series' },
        itemStyle: { color: C[i % C.length] },
        data: D.size.share[c]
      };
    });
    make(el('chart-size'), {
      tooltip: tooltipBase({ valueFormatter: function (v) { return v == null ? '—' : (+v).toFixed(2) + '%'; } }),
      legend: legendBase({ type: 'scroll' }),
      grid: gridOpt(10, 16, 58, 6),
      xAxis: { type: 'category', data: MLABELS, boundaryGap: false, axisLabel: axisLabel(), axisLine: AXIS_LINE, axisTick: { show: false } },
      yAxis: { type: 'value', max: 100, axisLabel: axisLabel({ formatter: '{value}%' }), splitLine: { lineStyle: { color: '#f0f3f8' } } },
      series: series
    });

    var series2 = cats.map(function (c, i) {
      return {
        name: c, type: 'line', smooth: true, symbolSize: 5, connectNulls: true,
        lineStyle: { width: 2, color: C[i % C.length] },
        itemStyle: { color: C[i % C.length] },
        data: D.size.salaryTrend[c]
      };
    });
    make(el('chart-sizesal'), {
      tooltip: tooltipBase({ valueFormatter: function (v) { return v == null ? '—' : fmtInt(v) + ' 元'; } }),
      legend: legendBase({ type: 'scroll' }),
      grid: gridOpt(10, 16, 58, 6),
      xAxis: { type: 'category', data: MLABELS, axisLabel: axisLabel(), axisLine: AXIS_LINE, axisTick: { show: false } },
      yAxis: {
        type: 'value', name: '元/月', nameTextStyle: axisLabel(),
        min: function (v) { return Math.floor((v.min - 400) / 500) * 500; },
        axisLabel: axisLabel({ formatter: function (v) { return (v / 1000).toFixed(0) + 'k'; } }),
        splitLine: { lineStyle: { color: '#f0f3f8' } }
      },
      series: series2
    });
  }

  /* ------------------------------------------------------------ 7 福利 */
  function renderBenefits() {
    make(el('chart-bencover'), {
      tooltip: tooltipBase({
        formatter: function (ps) {
          var p = ps[0];
          return MLABELS[p.dataIndex] + '<br/>填写福利的岗位占比：<b>' + p.value + '%</b>';
        }
      }),
      grid: gridOpt(10, 20, 20, 6),
      xAxis: { type: 'category', data: MLABELS, axisLabel: axisLabel(), axisLine: AXIS_LINE, axisTick: { show: false } },
      yAxis: { type: 'value', max: 100, axisLabel: axisLabel({ formatter: '{value}%' }), splitLine: { lineStyle: { color: '#f0f3f8' } } },
      series: [{
        type: 'line', smooth: true, symbolSize: 5, data: D.benefits.labelledShare,
        lineStyle: { width: 2.4, color: '#8b5cf6' }, itemStyle: { color: '#8b5cf6' },
        areaStyle: { color: areaGrad('#8b5cf6') }
      }]
    });

    var top = D.benefits.overall.slice(0, 12).slice().sort(function (a, b) { return a.postShare - b.postShare; });
    make(el('chart-ben'), {
      tooltip: tooltipBase({
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var name = ps[0].name;
          var row = top.filter(function (r) { return r.name === name; })[0] || {};
          return '<b>' + name + '</b><br/>岗位占比：' + row.postShare + '%<br/>岗位数：' +
            fmtInt(row.count) + '<br/>平均薪资：' + fmtInt(row.avgSalary) + ' 元/月';
        }
      }),
      grid: gridOpt(6, 66, 10, 6),
      xAxis: {
        type: 'value', position: 'bottom',
        axisLabel: axisLabel({ formatter: '{value}%' }), splitLine: { lineStyle: { color: '#f0f3f8' } }
      },
      yAxis: { type: 'category', data: top.map(function (r) { return r.name; }), axisLabel: axisLabel({ fontSize: 11 }), axisLine: AXIS_LINE, axisTick: { show: false } },
      series: [
        {
          name: '岗位占比', type: 'bar', barMaxWidth: 14, barGap: '-100%',
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#8b5cf6' }, { offset: 1, color: '#b79bf7' }])
          },
          data: top.map(function (r) { return r.postShare; }),
          label: { show: true, position: 'right', fontSize: 10, color: '#4a5a70', formatter: '{c}%' }
        }
      ]
    });

    var trendCats = D.benefits.overall.slice(0, 6).map(function (r) { return r.name; });
    make(el('chart-bentrend'), {
      tooltip: tooltipBase({ valueFormatter: function (v) { return v == null ? '—' : (+v).toFixed(2) + '%'; } }),
      legend: legendBase({ type: 'scroll' }),
      grid: gridOpt(10, 20, 46, 6),
      xAxis: { type: 'category', data: MLABELS, axisLabel: axisLabel(), axisLine: AXIS_LINE, axisTick: { show: false } },
      yAxis: { type: 'value', name: '占当月岗位比例', nameTextStyle: axisLabel(), axisLabel: axisLabel({ formatter: '{value}%' }), splitLine: { lineStyle: { color: '#f0f3f8' } } },
      series: trendCats.map(function (c, i) {
        return {
          name: c, type: 'line', smooth: true, symbolSize: 5,
          lineStyle: { width: 2.2, color: C[i] }, itemStyle: { color: C[i] },
          data: D.benefits.share[c]
        };
      })
    });
  }

  /* ------------------------------------------------------------ 8 技能 */
  function renderSkills() {
    var top = D.skills.overall.slice().sort(function (a, b) { return a.count - b.count; }).slice(-20);
    make(el('chart-skill'), {
      tooltip: tooltipBase({
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var name = ps[0].name;
          var row = top.filter(function (r) { return r.name === name; })[0] || {};
          return '<b>' + name + '</b><br/>岗位数：' + fmtInt(row.count) + '<br/>岗位占比：' + row.postShare + '%';
        }
      }),
      grid: gridOpt(6, 66, 10, 6),
      xAxis: { type: 'value', axisLabel: axisLabel({ formatter: '{value}%' }), splitLine: { lineStyle: { color: '#f0f3f8' } } },
      yAxis: { type: 'category', data: top.map(function (r) { return r.name; }), axisLabel: axisLabel({ fontSize: 11 }), axisLine: AXIS_LINE, axisTick: { show: false } },
      series: [{
        type: 'bar', barMaxWidth: 13,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#12b3a0' }, { offset: 1, color: '#63d6c6' }])
        },
        data: top.map(function (r) { return r.postShare; }),
        label: { show: true, position: 'right', fontSize: 10, color: '#4a5a70', formatter: '{c}%' }
      }]
    });

    var cats = D.skills.categories.slice();
    make(el('chart-skilltrend'), {
      tooltip: tooltipBase({ valueFormatter: function (v) { return v == null ? '—' : (+v).toFixed(2) + '%'; } }),
      legend: legendBase({ type: 'scroll', top: 0, left: 0, right: 0, height: 54 }),
      grid: gridOpt(10, 20, 84, 6),
      xAxis: { type: 'category', data: MLABELS, axisLabel: axisLabel(), axisLine: AXIS_LINE, axisTick: { show: false } },
      yAxis: { type: 'value', name: '占当月岗位比例', nameTextStyle: axisLabel(), axisLabel: axisLabel({ formatter: '{value}%' }), splitLine: { lineStyle: { color: '#f0f3f8' } } },
      series: cats.map(function (c, i) {
        return {
          name: c, type: 'line', smooth: true, symbolSize: 4,
          lineStyle: { width: 1.8, color: C[i % C.length] },
          itemStyle: { color: C[i % C.length] },
          data: D.skills.share[c]
        };
      })
    });
  }

  /* ---------------------------------------------------------------- init */
  function bindSeg(id, cb) {
    var wrap = el(id);
    if (!wrap) return;
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      Array.prototype.forEach.call(wrap.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      cb(b.getAttribute('data-v'));
    });
  }

  function init() {
    renderKPIs();
    renderTrend();
    renderSalary();
    renderBand();
    renderSalaryDim();
    renderEduExp();
    renderSize();
    renderBenefits();
    renderSkills();
    if (D.map_provinces) {
      echarts.registerMap('china', D.map_provinces);
      initCity();
    }
    make(el('chart-edu'), stackShareOption(D.education, 0.3, 0));
    make(el('chart-exp'), stackShareOption(D.experience, 0.3, 0));

    bindSeg('trend-grain', function (v) {
      trendGrain = v;
      renderTrend();
    });
    el('trend-kind').addEventListener('change', function () {
      trendKind = this.checked;
      renderTrend();
    });
    bindSeg('salary-scope', function (v) {
      salaryScope = v;
      renderSalary();
    });
    bindSeg('salary-dim', function (v) {
      salaryDim = v;
      renderSalaryDim();
    });

    if (loadingEl) loadingEl.classList.add('hidden');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
