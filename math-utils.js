/**
 * 수학 유틸리티 - 도트 경마 v5.2 (수학 기반 버전)
 * 
 * 정규분포, 통계 함수, 확률 모델
 * 
 * @version 5.2.0
 * @author 도겜유튜브
 */
(function() {
  'use strict';

  /**
   * Box-Muller 변환으로 정규분포 난수 생성
   * @param {number} mean - 평균
   * @param {number} stdDev - 표준편차
   * @returns {number} 정규분포 난수
   */
  function randomNormal(mean, stdDev) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  /**
   * 중심극한정리를利用한 정규분포 (대체 방법)
   * @param {number} mean - 평균
   * @param {number} stdDev - 표준편차
   * @param {number} samples - 샘플 수 (기본 6)
   * @returns {number} 정규분포 난수
   */
  function randomNormalCLT(mean, stdDev, samples) {
    samples = samples || 6;
    let sum = 0;
    for (let i = 0; i < samples; i++) {
      sum += Math.random();
    }
    const normalized = (sum - samples / 2) / Math.sqrt(samples / 12);
    return mean + normalized * stdDev;
  }

  /**
   * 표준정규분포 누적분포함수 (CDF)
   * @param {number} x - 값
   * @returns {number} 누적확률 0-1
   */
  function normalCDF(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * 정규분포 확률밀도함수 (PDF)
   * @param {number} x - 값
   * @param {number} mean - 평균
   * @param {number} stdDev - 표준편차
   * @returns {number} 확률밀도
   */
  function normalPDF(x, mean, stdDev) {
    const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
  }

  /**
   * 값 클램핑 (범위 제한)
   * @param {number} value - 값
   * @param {number} min - 최소값
   * @param {number} max - 최대값
   * @returns {number} 클램핑된 값
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * 선형 보간 (Lerp)
   * @param {number} a - 시작값
   * @param {number} b - 끝값
   * @param {number} t - 비율 (0-1)
   * @returns {number} 보간값
   */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * 값 정규화 (0-1 범위)
   * @param {number} value - 값
   * @param {number} min - 최소
   * @param {number} max - 최대
   * @returns {number} 정규화된 값
   */
  function normalize(value, min, max) {
    if (max === min) return 0.5;
    return clamp((value - min) / (max - min), 0, 1);
  }

  /**
   * 표준편차 계산
   * @param {Array} values - 값 배열
   * @returns {number} 표준편차
   */
  function standardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * 평균 계산
   * @param {Array} values - 값 배열
   * @returns {number} 평균
   */
  function mean(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * 가중 평균 계산
   * @param {Array} values - 값 배열
   * @param {Array} weights - 가중치 배열
   * @returns {number} 가중 평균
   */
  function weightedMean(values, weights) {
    if (!values || !weights || values.length !== weights.length) return 0;
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    if (sumWeights === 0) return 0;
    const sumWeighted = values.reduce((total, v, i) => total + v * weights[i], 0);
    return sumWeighted / sumWeights;
  }

  /**
   * 두 배열의 상관계수 계산
   * @param {Array} x - 배열 1
   * @param {Array} y - 배열 2
   * @returns {number} 상관계수 (-1 ~ 1)
   */
  function correlation(x, y) {
    if (!x || !y || x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const meanX = mean(x);
    const meanY = mean(y);

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denominator = Math.sqrt(denomX * denomY);
    if (denominator === 0) return 0;

    return numerator / denominator;
  }

  /**
   * 감마 함수 (스탯 분포용)
   * @param {number} x - 값
   * @returns {number} 감마값
   */
  function gamma(x) {
    const g = 7;
    const c = [
      0.99999999999980993,
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7
    ];

    if (x < 0.5) {
      return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
    }

    x -= 1;
    let a = c[0];
    const t = x + g + 0.5;

    for (let i = 1; i < c.length; i++) {
      a += c[i] / (x + i);
    }

    return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
  }

  /**
   * 베타 함수
   * @param {number} a - 알파
   * @param {number} b - 베타
   * @returns {number} 베타값
   */
  function beta(a, b) {
    return (gamma(a) * gamma(b)) / gamma(a + b);
  }

  /**
   * 이항계수 계산
   * @param {number} n - 전체 수
   * @param {number} k - 선택 수
   * @returns {number} 이항계수
   */
  function binomial(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    if (k > n / 2) k = n - k;

    let result = 1;
    for (let i = 0; i < k; i++) {
      result *= (n - i) / (i + 1);
    }
    return Math.round(result);
  }

  /**
   * 이항 분포 확률
   * @param {number} k - 성공 횟수
   * @param {number} n - 총 시도 횟수
   * @param {number} p - 성공 확률
   * @returns {number} 확률
   */
  function binomialProbability(k, n, p) {
    return binomial(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
  }

  /**
   * 누적 이항 분포 (CDF)
   * @param {number} k - 성공 횟수
   * @param {number} n - 총 시도 횟수
   * @param {number} p - 성공 확률
   * @returns {number} 누적 확률
   */
  function binomialCDF(k, n, p) {
    let sum = 0;
    for (let i = 0; i <= k; i++) {
      sum += binomialProbability(i, n, p);
    }
    return sum;
  }

  /**
   * 지수 함수 (자연로그)
   * @param {number} x - 값
   * @returns {number} exp(x)
   */
  function exp(x) {
    return Math.exp(x);
  }

  /**
   * 로그 함수 (밑 e)
   * @param {number} x - 값
   * @returns {number} ln(x)
   */
  function log(x) {
    if (x <= 0) return -Infinity;
    return Math.log(x);
  }

  /**
   * 로그 함수 (밑 10)
   * @param {number} x - 값
   * @returns {number} log10(x)
   */
  function log10(x) {
    if (x <= 0) return -Infinity;
    return Math.log10(x);
  }

  /**
   * 퍼센트 계산
   * @param {number} value - 값
   * @param {number} total - 전체
   * @returns {number} 퍼센트 (0-100)
   */
  function percent(value, total) {
    if (total === 0) return 0;
    return (value / total) * 100;
  }

  /**
   * 로짓 함수 (확률 → 로짓)
   * @param {number} p - 확률 (0-1)
   * @returns {number} 로짓값
   */
  function logit(p) {
    if (p <= 0 || p >= 1) return p <= 0 ? -Infinity : Infinity;
    return log(p / (1 - p));
  }

  /**
   * 시그모이드 함수 (로짓 → 확률)
   * @param {number} x - 로짓값
   * @returns {number} 확률 (0-1)
   */
  function sigmoid(x) {
    return 1 / (1 + exp(-x));
  }

  /**
   * 안전한 나눗셈
   * @param {number} a - 피나눈 수
   * @param {number} b - 나누는 수
   * @param {number} defaultValue - 기본값
   * @returns {number} 결과
   */
  function safeDivide(a, b, defaultValue) {
    if (b === 0 || isNaN(a) || isNaN(b)) return defaultValue || 0;
    return a / b;
  }

  /**
   * 랜덤 범위 정수
   * @param {number} min - 최소
   * @param {number} max - 최대
   * @returns {number} 랜덤 정수
   */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 랜덤 범위 실수
   * @param {number} min - 최소
   * @param {number} max - 최대
   * @returns {number} 랜덤 실수
   */
  function randFloat(min, max) {
    return min + Math.random() * (max - min);
  }

  /**
   * 배열 셔플 (Fisher-Yates)
   * @param {Array} array - 배열
   * @returns {Array} 셔플된 배열
   */
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * 배열에서 랜덤 선택
   * @param {Array} array - 배열
   * @returns {*} 랜덤 요소
   */
  function randomChoice(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * 가중치 기반 랜덤 선택
   * @param {Array} items - 아이템 배열
   * @param {Array} weights - 가중치 배열
   * @returns {*} 선택된 아이템
   */
  function weightedRandomChoice(items, weights) {
    if (!items || !weights || items.length !== weights.length) return null;
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return randomChoice(items);

    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) return items[i];
    }
    
    return items[items.length - 1];
  }

  /**
   * 기대값 계산
   * @param {Array} values - 값 배열
   * @param {Array} probabilities - 확률 배열
   * @returns {number} 기대값
   */
  function expectedValue(values, probabilities) {
    if (!values || !probabilities || values.length !== probabilities.length) return 0;
    return values.reduce((total, v, i) => total + v * probabilities[i], 0);
  }

  /**
   * 분산 계산
   * @param {Array} values - 값 배열
   * @returns {number} 분산
   */
  function variance(values) {
    if (!values || values.length === 0) return 0;
    const avg = mean(values);
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    return mean(squaredDiffs);
  }

  /**
   *变异係수 계산
   * @param {Array} values - 값 배열
   * @returns {number}变异係수
   */
  function coefficientOfVariation(values) {
    const avg = mean(values);
    const sd = standardDeviation(values);
    if (avg === 0) return 0;
    return (sd / avg) * 100;
  }

  /**
   * 최소-최대 정규화
   * @param {Array} values - 값 배열
   * @returns {Array} 정규화된 값 (0-1)
   */
  function minMaxNormalize(values) {
    if (!values || values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return values.map(() => 0.5);
    return values.map(v => (v - min) / (max - min));
  }

  /**
   * Z-점수 계산
   * @param {number} value - 값
   * @param {number} mean - 평균
   * @param {number} stdDev - 표준편차
   * @returns {number} Z-점수
   */
  function zScore(value, mean, stdDev) {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  /**
   * 신뢰구간 계산
   * @param {number} confidence - 신뢰도 (0-1)
   * @param {number} stdDev - 표준편차
   * @param {number} n - 샘플 수
   * @returns {Object} {min, max} 구간
   */
  function confidenceInterval(confidence, stdDev, n) {
    const z = confidence === 0.95 ? 1.96 : 
              confidence === 0.99 ? 2.576 : 
              confidence === 0.90 ? 1.645 : 1.96;
    const margin = z * (stdDev / Math.sqrt(n));
    return { margin, lower: -margin, upper: margin };
  }

  /**
   * 포아송 분포 (희귀 사건 확률)
   * @param {number} k - 발생 횟수
   * @param {number} lambda - 평균 발생률
   * @returns {number} 확률
   */
  function poisson(k, lambda) {
    return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k);
  }

  /**
   *阶乗 계산
   * @param {number} n - 수
   * @returns {number} n!
   */
  function factorial(n) {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  }

  /**
   * 조합 계산 (nCk)
   * @param {number} n - 전체
   * @param {number} k - 선택
   * @returns {number} 조합 수
   */
  function combinations(n, k) {
    return factorial(n) / (factorial(k) * factorial(n - k));
  }

  // 전역 노출
  window.MathUtils = {
    randomNormal,
    randomNormalCLT,
    normalCDF,
    normalPDF,
    clamp,
    lerp,
    normalize,
    standardDeviation,
    mean,
    weightedMean,
    correlation,
    gamma,
    beta,
    binomial,
    binomialProbability,
    binomialCDF,
    exp,
    log,
    log10,
    percent,
    logit,
    sigmoid,
    safeDivide,
    randInt,
    randFloat,
    shuffle,
    randomChoice,
    weightedRandomChoice,
    expectedValue,
    variance,
    coefficientOfVariation,
    minMaxNormalize,
    zScore,
    confidenceInterval,
    poisson,
    factorial,
    combinations
  };

  console.log('[MathUtils v5.2.0] Loaded - Statistical & Math functions ready');
})();
