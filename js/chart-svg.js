/**
 * SVG 차트 엔진 - 도트 경마 v5.1
 * 
 * 외부 의존성: 없음 (순수 Vanilla JavaScript)
 * SVG를 사용하여 외부 라이브러리 없이 차트를 렌더링합니다.
 * 
 * 사용 방법:
 * - Line 차트: window.ChartEngine.createLineChart({ data, width, height, color, ... })
 * - Bar 차트: window.ChartEngine.createBarChart({ data, width, height, horizontal, ... })
 * - Pie/Donut 차트: window.ChartEngine.createPieChart({ data, width, height, donut, ... })
 * 
 * @version 5.1.0
 * @author 도겜유튜브
 */

(function() {
  'use strict';

  /**
   * 차트 색상 테마 - 다크 모드 호환
   */
  const COLORS = {
    primary: '#6C5CE7',      // 주 색상 (보라)
    secondary: '#9df7c7',    // 양수/승리 (초록)
    warning: '#ffd26e',       // 경고/주의 (노랑)
    danger: '#ff7a9e',       // 음수/실패 (빨강)
    gold: '#FFD700',          // 금색 (1위/트렌드)
    text: '#c8d0ff',          // 일반 텍스트
    grid: '#1f2940',          // 그리드 선
    axis: '#8890b0',          // 축 라벨
    background: '#0b0e16',    // 차트 배경
    panel: '#0f1424',         // 패널 배경
    card: '#131a33',          // 카드 배경
    // 막대 그래프 색상 배열
    bar: ['#6C5CE7', '#9df7c7', '#ffd26e', '#ff7a9e', '#feca57', '#54a0ff', '#ff9ff3', '#48dbfb'],
    // 파이 차트 색상 배열
    pie: ['#6C5CE7', '#9df7c7', '#ffd26e', '#ff7a9e', '#feca57', '#54a0ff']
  };

  /**
   * 한국어 숫자 포맷팅
   * @param {number} v - 포맷할 숫자
   * @returns {string} 포맷된 문자열
   */
  const fmt = v => Math.floor(v).toLocaleString('ko-KR');

  /**
   * 라인 차트 생성 함수
   * 누적 수익 추이, 시계열 데이터 등에 사용
   * 
   * @param {Object} params - 차트 파라미터
   * @param {Array} params.data - [{label: 'R1', value: 5000}, ...]
   * @param {number} params.width - 차트 너비 (px)
   * @param {number} params.height - 차트 높이 (px)
   * @param {string} params.title - 차트 제목
   * @param {string} params.color - 라인 색상
   * @param {boolean} params.showArea - 영역 채우기 여부
   * @param {boolean} params.showPoints - 데이터 점 표시 여부
   * @param {boolean} params.showGrid - 그리드 표시 여부
   * @param {boolean} params.showLabels - 라벨 표시 여부
   * @param {boolean} params.showTrendLine - 추세선 표시 여부
   * @returns {string} SVG 문자열
   */
  function createLineChart(params) {
    const { 
      data = [], 
      width = 600, 
      height = 200, 
      title = '', 
      color = COLORS.primary, 
      showArea = true, 
      showPoints = true, 
      showGrid = true, 
      showLabels = true, 
      showTrendLine = false 
    } = params;

    // 데이터가 없을 경우 빈 차트 반환
    if (data.length === 0) {
      return '<svg width="' + width + '" height="' + height + '"><text x="50%" y="50%" text-anchor="middle" fill="' + COLORS.text + '">데이터 없음</text></svg>';
    }

    // 패딩 설정 (차트 여백)
    const padding = { top: 25, right: 20, bottom: 35, left: 55 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Y축 스케일 계산
    const values = data.map(d => d.value);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values) * 1.1;
    const range = maxVal - minVal || 1;

    // X, Y 스케일 변환 함수
    const scaleX = (i) => padding.left + (i / (data.length - 1)) * chartWidth;
    const scaleY = (v) => padding.top + chartHeight - ((v - minVal) / range) * chartHeight;

    // 라인 포인트 좌표 생성
    const points = data.map((d, i) => scaleX(i) + ',' + scaleY(d.value)).join(' ');
    
    // 영역 채우기 좌표 생성
    const areaPoints = [
      padding.left + ',' + (padding.top + chartHeight),
      ...data.map((d, i) => scaleX(i) + ',' + scaleY(d.value)),
      (padding.left + chartWidth) + ',' + (padding.top + chartHeight)
    ].join(' ');

    // 추세선 계산 (선형 회귀)
    let trendLineSvg = '';
    if (showTrendLine && data.length >= 2) {
      const n = data.length;
      // 최소 제곱법으로 기울기와 절편 계산
      const sumX = (n * (n - 1)) / 2;
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = data.reduce((sum, d, i) => sum + i * d.value, 0);
      const sumXX = (n - 1) * n * (2 * n - 1) / 6;
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      const trendStart = scaleY(intercept);
      const trendEnd = scaleY(slope * (n - 1) + intercept);
      
      trendLineSvg = '<line x1="' + padding.left + '" y1="' + trendStart + 
        '" x2="' + (padding.left + chartWidth) + '" y2="' + trendEnd + 
        '" stroke="' + COLORS.gold + '" stroke-width="2" stroke-dasharray="5,5" opacity="0.7"/>';
    }

    // 그리드 SVG 생성
    let gridSvg = '';
    if (showGrid) {
      const yTicks = 5;
      gridSvg = '<g>';
      for (let i = 0; i <= yTicks; i++) {
        const y = padding.top + (i / yTicks) * chartHeight;
        const val = maxVal - (i / yTicks) * range;
        gridSvg += '<line x1="' + padding.left + '" y1="' + y + 
          '" x2="' + (padding.left + chartWidth) + '" y2="' + y + 
          '" stroke="' + COLORS.grid + '" stroke-width="1"/>';
        if (showLabels) {
          gridSvg += '<text x="' + (padding.left - 8) + '" y="' + (y + 4) + 
            '" fill="' + COLORS.axis + '" text-anchor="end" font-size="10">' + fmt(val) + '</text>';
        }
      }
      gridSvg += '</g>';
    }

    // X축 라벨 생성
    let labelsSvg = '';
    if (showLabels && data.length > 1) {
      const step = Math.max(1, Math.floor(data.length / 8));
      labelsSvg = data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d, i) => {
        const idx = data.findIndex(x => x === d);
        return '<text x="' + scaleX(idx) + '" y="' + (height - 12) + 
          '" fill="' + COLORS.axis + '" text-anchor="middle" font-size="10">' + d.label + '</text>';
      }).join('');
    }

    // 데이터 점 SVG 생성 (호버 효과 포함)
    let pointsSvg = '';
    if (showPoints) {
      pointsSvg = data.map((d, i) => 
        '<circle cx="' + scaleX(i) + '" cy="' + scaleY(d.value) + 
        '" r="4" fill="' + color + '" stroke="#fff" stroke-width="2" ' +
        'style="cursor:pointer;transition:r 0.2s" ' +
        'onmouseover="this.setAttribute(\'r\',6)" onmouseout="this.setAttribute(\'r\',4)"/>'
      ).join('');
    }

    // 최종 SVG 조합
    return '<svg width="' + width + '" height="' + height + 
      '" style="font-family:system-ui,-apple-system,sans-serif;background:' + COLORS.background + ';border-radius:8px;">' +
      gridSvg +
      (showArea ? '<polygon points="' + areaPoints + '" fill="' + color + '" opacity="0.15"/>' : '') +
      trendLineSvg +
      '<polyline points="' + points + '" fill="none" stroke="' + color + 
      '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      pointsSvg + labelsSvg +
      (title ? '<text x="' + (width / 2) + '" y="14" fill="' + COLORS.text + 
        '" text-anchor="middle" font-weight="600" font-size="12">' + title + '</text>' : '') +
      '</svg>';
  }

  /**
   * 막대 그래프 생성 함수
   * 말별/기수별 승률, 트랙별 출전 수 등에 사용
   * 
   * @param {Object} params - 차트 파라미터
   * @param {Array} params.data - [{label: '은하스텝', value: 75.5, suffix: '%'}, ...]
   * @param {number} params.width - 차트 너비
   * @param {number} params.height - 차트 높이
   * @param {string} params.title - 차트 제목
   * @param {boolean} params.horizontal - 가로 막대 여부
   * @param {boolean} params.showValues - 값 표시 여부
   * @param {Array} params.colorArray - 색상 배열
   * @returns {string} SVG 문자열
   */
  function createBarChart(params) {
    const { 
      data = [], 
      width = 400, 
      height = 200, 
      title = '', 
      horizontal = false, 
      showValues = true, 
      colorArray = COLORS.bar 
    } = params;

    if (data.length === 0) {
      return '<svg width="' + width + '" height="' + height + '"><text x="50%" y="50%" text-anchor="middle" fill="' + COLORS.text + '">데이터 없음</text></svg>';
    }

    const padding = { top: 25, right: 20, bottom: 35, left: 55 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxVal = Math.max(...data.map(d => d.value)) * 1.1;
    const range = maxVal || 1;

    // 가로 막대 그래프
    if (horizontal) {
      const barHeight = Math.min(28, (chartHeight / data.length) - 10);
      return '<svg width="' + width + '" height="' + height + 
        '" style="font-family:system-ui,-apple-system,sans-serif;background:' + COLORS.background + ';border-radius:8px;">' +
        data.map((d, i) => {
          const barWidth = (d.value / range) * chartWidth;
          const y = padding.top + i * (barHeight + 8);
          const color = colorArray[i % colorArray.length];
          const label = d.label.length > 10 ? d.label.slice(0, 10) + '...' : d.label;
          
          return '<g>' +
            '<text x="' + (padding.left - 10) + '" y="' + (y + barHeight / 2 + 4) + 
              '" fill="' + COLORS.text + '" text-anchor="end" font-size="11">' + label + '</text>' +
            '<rect x="' + padding.left + '" y="' + y + '" width="' + chartWidth + 
              '" height="' + barHeight + '" fill="' + COLORS.grid + '" rx="4"/>' +
            '<rect x="' + padding.left + '" y="' + y + '" width="' + barWidth + 
              '" height="' + barHeight + '" fill="' + color + '" rx="4" style="transition:width 0.5s ease"/>' +
            (showValues ? '<text x="' + (padding.left + barWidth + 8) + '" y="' + (y + barHeight / 2 + 4) + 
              '" fill="' + COLORS.text + '" font-size="11" font-weight="600">' + d.value + (d.suffix || '') + '</text>' : '') +
            '</g>';
        }).join('') +
        (title ? '<text x="' + (width / 2) + '" y="14" fill="' + COLORS.text + 
          '" text-anchor="middle" font-weight="600" font-size="12">' + title + '</text>' : '') +
        '</svg>';
    }

    // 세로 막대 그래프
    const barWidth = (chartWidth / data.length) * 0.65;
    const gap = (chartWidth / data.length) * 0.35;

    return '<svg width="' + width + '" height="' + height + 
      '" style="font-family:system-ui,-apple-system,sans-serif;background:' + COLORS.background + ';border-radius:8px;">' +
      data.map((d, i) => {
        const barHeight = (d.value / range) * chartHeight;
        const x = padding.left + i * (barWidth + gap) + gap / 2;
        const y = padding.top + chartHeight - barHeight;
        const color = colorArray[i % colorArray.length];
        
        return '<g>' +
          '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + 
            '" fill="' + color + '" rx="2" style="transition:height 0.3s ease"/>' +
          (showValues ? '<text x="' + (x + barWidth / 2) + '" y="' + (y - 5) + 
            '" fill="' + COLORS.text + '" text-anchor="middle" font-size="10">' + d.value + '</text>' : '') +
          '<text x="' + (x + barWidth / 2) + '" y="' + (height - 10) + 
            '" fill="' + COLORS.axis + '" text-anchor="middle" font-size="9">' + d.label + '</text>' +
          '</g>';
      }).join('') +
      (title ? '<text x="' + (width / 2) + '" y="14" fill="' + COLORS.text + 
        '" text-anchor="middle" font-weight="600" font-size="12">' + title + '</text>' : '') +
      '</svg>';
  }

  /**
   * 파이/도넛 차트 생성 함수
   * 베팅 유형별 수익 구성 등에 사용
   * 
   * @param {Object} params - 차트 파라미터
   * @param {Array} params.data - [{label: '단승', value: 50000}, ...]
   * @param {number} params.width - 차트 너비
   * @param {number} params.height - 차트 높이
   * @param {string} params.title - 차트 제목
   * @param {boolean} params.donut - 도넛 차트 여부
   * @param {boolean} params.showLegend - 범례 표시 여부
   * @param {Array} params.colorArray - 색상 배열
   * @returns {string} SVG 문자열
   */
  function createPieChart(params) {
    const { 
      data = [], 
      width = 300, 
      height = 250, 
      title = '', 
      donut = true, 
      showLegend = true, 
      colorArray = COLORS.pie 
    } = params;

    if (data.length === 0) {
      return '<svg width="' + width + '" height="' + height + '"><text x="50%" y="50%" text-anchor="middle" fill="' + COLORS.text + '">데이터 없음</text></svg>';
    }

    const cx = width / 2;
    const cy = height / 2 - 15;
    const radius = Math.min(width, height) / 2 - 35;
    const innerRadius = donut ? radius * 0.6 : 0;
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let currentAngle = -Math.PI / 2;

    // 슬라이스 경로 계산
    const slices = data.map((d, i) => {
      const angle = (d.value / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      // 원형 경로 좌표 계산
      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);
      const x3 = cx + innerRadius * Math.cos(endAngle);
      const y3 = cy + innerRadius * Math.sin(endAngle);
      const x4 = cx + innerRadius * Math.cos(startAngle);
      const y4 = cy + innerRadius * Math.sin(startAngle);
      
      const largeArc = angle > Math.PI ? 1 : 0;
      
      // 도넛 또는 일반 파이 차트 경로
      const path = innerRadius > 0 
        ? 'M ' + x1 + ' ' + y1 + ' A ' + radius + ' ' + radius + ' 0 ' + largeArc + ' 1 ' + x2 + ' ' + y2 + 
          ' L ' + x3 + ' ' + y3 + ' A ' + innerRadius + ' ' + innerRadius + ' 0 ' + largeArc + ' 0 ' + x4 + ' ' + y4 + ' Z'
        : 'M ' + cx + ' ' + cy + ' L ' + x1 + ' ' + y1 + ' A ' + radius + ' ' + radius + ' 0 ' + largeArc + ' 1 ' + x2 + ' ' + y2 + ' Z';
      
      currentAngle = endAngle;
      
      return { 
        path, 
        color: colorArray[i % colorArray.length], 
        ...d, 
        percent: ((d.value / total) * 100).toFixed(1) 
      };
    });

    const legendWidth = showLegend ? 130 : 0;

    // 최종 SVG 조합
    return '<svg width="' + width + '" height="' + height + 
      '" style="font-family:system-ui,-apple-system,sans-serif;background:' + COLORS.background + ';border-radius:8px;">' +
      // 슬라이스 (호버 효과 포함)
      '<g>' + slices.map(s => 
        '<path d="' + s.path + '" fill="' + s.color + 
        '" style="cursor:pointer;transition:transform 0.2s" ' +
        'onmouseover="this.style.transform=\'scale(1.03)\'" onmouseout="this.style.transform=\'scale(1)\'"/>'
      ).join('') + '</g>' +
      // 범례
      (showLegend 
        ? '<g transform="translate(' + (width - legendWidth + 5) + ', ' + (cy - 50) + ')">' +
          data.map((d, i) => 
            '<g transform="translate(0, ' + (i * 24) + ')">' +
            '<rect width="14" height="14" fill="' + colorArray[i % colorArray.length] + '" rx="2"/>' +
            '<text x="20" y="11" fill="' + COLORS.text + '" font-size="10">' + d.label + ' ' + (d.suffix || '') + '</text>' +
            '</g>'
          ).join('') + '</g>' 
        : '') +
      // 제목
      (title 
        ? '<text x="' + (width / 2) + '" y="15" fill="' + COLORS.text + 
          '" text-anchor="middle" font-weight="600" font-size="12">' + title + '</text>' 
        : '') +
      '</svg>';
  }

  /**
   * 차트 엔진 전역 객체
   */
  window.ChartEngine = { 
    COLORS,           // 색상 테마
    createLineChart,  // 라인 차트 생성
    createBarChart,   // 막대 그래프 생성
    createPieChart,   // 파이/도넛 차트 생성
    fmt               // 숫자 포맷팅
  };

})();
