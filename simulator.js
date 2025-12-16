// Websea Trading Simulator - JavaScript Version
// 거래 시뮬레이션 및 에어드랍 계산

// 스크롤 페이지네이션을 위한 전역 변수
let allResults = [];
let currentDisplayIndex = 0;
const BATCH_SIZE = 50;
let isLoading = false;
let observer = null;

// 에어드랍 금액표
const AIRDROP_RATE_BY_ACTIVE_DAY = {
    1: 0.2067, 2: 0.2267, 3: 0.2467, 4: 0.2667, 5: 0.2867,
    6: 0.31, 7: 0.3333, 8: 0.36, 9: 0.3867, 10: 0.4133,
    11: 0.4467, 12: 0.4834, 13: 0.5166, 14: 0.5566, 15: 0.5966,
    16: 0.6434, 17: 0.69, 18: 0.74, 19: 0.7933, 20: 0.8533,
    21: 0.9167, 22: 0.9833, 23: 1.0567, 24: 1.1334, 25: 1.2167,
    26: 1.3033, 27: 1.4033, 28: 1.5067, 29: 1.6133, 30: 1.73,
    31: 1.8533, 32: 1.9867, 33: 2.13, 34: 2.2866, 35: 2.45,
    36: 2.6267, 37: 2.8166, 38: 3.02, 39: 3.2367, 40: 3.4734,
    41: 3.7233, 42: 3.99, 43: 4.28, 44: 4.5866, 45: 4.92,
    46: 5.2733, 47: 5.65, 48: 6.0567, 49: 6.49, 50: 6.93
};

// 거래 설정
class TradingSettings {
    constructor(config = {}) {
        this.initialInvestment = config.initialInvestment || 10000.0;
        this.leverage = config.leverage || 25;
        this.winCount = config.winCount || 75;
        this.lossCount = config.lossCount || 30;

        // 고정값
        this.bootingRate = 0.10;
        this.tradeFeeRate = 0.03;
        this.selfReferralRate = 0.20;
        this.dailyTrades = 105;

        // 봇 설정
        this.seedRate = 0.01;
        this.winProfitRate = 0.05;
        this.lossRate = 0.10;

        // 보험 설정
        this.nodeCost = 100;
        this.nodeActivationDelay = 3;
        this.nodeExpiryDays = 53;
    }

    getCapitalSeed() {
        return this.initialInvestment * (1 - this.bootingRate);
    }
}

// 일일 시뮬레이션 결과
class DayResult {
    constructor() {
        this.day = 0;
        this.capitalPlusClaim = 0;
        this.startCapital = 0;
        this.cumulativeClaim = 0;
        this.seed = 0;
        this.winCount = 0;
        this.lossCount = 0;
        this.totalProfit = 0;
        this.totalLoss = 0;
        this.dailyPnl = 0;
        this.dailyFee = 0;
        this.selfReferral = 0;
        this.netPnl = 0;
        this.endCapital = 0;
        this.insuranceNodeCumulative = 0;
        this.newNodesToday = 0;
        this.carryoverLoss = 0;
        this.waitingNodes = 0;
        this.activeNodes = 0;
        this.expiredNodes = 0;
        this.newlyActivatedNodes = 0;
        this.todayAirdropTotal = 0;
        this.cumulativeAirdrop = 0;
        this.totalCapital = 0;
    }
}

// 거래 시뮬레이터
class TradingSimulator {
    constructor(settings, simulationDays = 30) {
        this.settings = settings;
        this.simulationDays = simulationDays;
        this.results = [];
    }

    runSimulation() {
        this.results = [];
        let prevResult = null;

        for (let day = 1; day <= this.simulationDays; day++) {
            const result = this.calculateDay(day, prevResult);
            this.results.push(result);
            prevResult = result;
        }

        return this.results;
    }

    calculateDay(day, prev) {
        const result = new DayResult();
        result.day = day;

        // C: 시작 자본
        if (day === 1) {
            result.startCapital = this.settings.getCapitalSeed();
        } else {
            result.startCapital = prev.endCapital;
        }

        // D: 누적 Claim (현재는 0으로 처리)
        result.cumulativeClaim = prev ? prev.cumulativeClaim : 0;

        // B: 자본+Claim 합
        result.capitalPlusClaim = result.startCapital + result.cumulativeClaim;

        // E: 시드
        result.seed = result.capitalPlusClaim * this.settings.seedRate;

        // F, G: 승리/패배 횟수
        result.winCount = this.settings.winCount;
        result.lossCount = this.settings.lossCount;

        // H: 총 익절 금액
        result.totalProfit = result.seed * this.settings.winProfitRate * result.winCount;

        // I: 총 손절 금액 (음수)
        result.totalLoss = -result.seed * this.settings.lossRate * result.lossCount;

        // J: 일일 손익
        result.dailyPnl = result.totalProfit + result.totalLoss;

        // K: 일일 수수료
        result.dailyFee = result.seed * this.settings.tradeFeeRate * this.settings.dailyTrades;

        // L: 셀프 레퍼럴
        result.selfReferral = result.dailyFee * this.settings.selfReferralRate;

        // M: 순손익
        result.netPnl = result.dailyPnl - result.dailyFee + result.selfReferral;

        // N: 종료 자본
        result.endCapital = result.startCapital + result.netPnl;

        // O: 보험 노드 누적
        result.insuranceNodeCumulative = Math.abs(result.totalLoss);

        // P: 당일 생성 노드
        result.newNodesToday = Math.floor(result.insuranceNodeCumulative / this.settings.nodeCost);

        // Q: 이월 손실
        result.carryoverLoss = result.insuranceNodeCumulative % this.settings.nodeCost;

        // R: 대기 노드 수
        if (day === 1) {
            result.waitingNodes = result.newNodesToday;
        } else {
            const startIdx = Math.max(0, day - this.settings.nodeActivationDelay - 1);
            result.waitingNodes = this.results.slice(startIdx, day).reduce((sum, r) => sum + r.newNodesToday, 0);
            if (day >= this.settings.nodeActivationDelay + 1) {
                result.waitingNodes -= this.results[day - this.settings.nodeActivationDelay - 1].newNodesToday;
            }
        }

        // T: 만료된 노드 수
        if (day <= this.settings.nodeExpiryDays) {
            result.expiredNodes = 0;
        } else {
            const expiredDay = day - this.settings.nodeExpiryDays;
            result.expiredNodes = this.results[expiredDay - 1].newNodesToday;
        }

        // S: 활성 노드 수
        const totalNodesCreated = this.results.reduce((sum, r) => sum + r.newNodesToday, result.newNodesToday);
        const totalExpired = this.results.reduce((sum, r) => sum + r.expiredNodes, result.expiredNodes);
        result.activeNodes = totalNodesCreated - result.waitingNodes - totalExpired;

        // U: 새로 활성된 노드 수
        if (day <= this.settings.nodeActivationDelay) {
            result.newlyActivatedNodes = 0;
        } else {
            const activationDay = day - this.settings.nodeActivationDelay;
            result.newlyActivatedNodes = this.results[activationDay - 1].newNodesToday;
        }

        // V: 오늘 에어드랍 총액
        result.todayAirdropTotal = this.calculateDailyAirdrop(day);

        // W: 누적 에어드랍 합계
        result.cumulativeAirdrop = this.results.reduce((sum, r) => sum + r.todayAirdropTotal, result.todayAirdropTotal);

        // X: 총 자본
        result.totalCapital = result.endCapital + result.cumulativeAirdrop;

        return result;
    }

    calculateDailyAirdrop(day) {
        let total = 0;

        for (let pastDay = 1; pastDay < day; pastDay++) {
            if (pastDay > this.results.length) continue;

            const nodesCreated = this.results[pastDay - 1].newNodesToday;
            const activationDay = pastDay + this.settings.nodeActivationDelay;

            if (activationDay > day) continue;

            const activeDay = day - activationDay + 1;

            if (activeDay < 1 || activeDay > 50) continue;

            const airdropPerNode = AIRDROP_RATE_BY_ACTIVE_DAY[activeDay] || 0;
            total += airdropPerNode * nodesCreated;
        }

        return total;
    }
}

// UI 함수들
function formatNumber(num, decimals = 2) {
    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatNumberInput(value) {
    // 쉼표와 숫자 이외의 문자 제거
    const cleanValue = value.replace(/[^\d]/g, '');

    // 빈 값이면 빈 문자열 반환
    if (!cleanValue) return '';

    // 숫자에 쉼표 추가
    return parseInt(cleanValue).toLocaleString('en-US');
}

function getNumericValue(element) {
    // input 요소에서 순수 숫자 값 추출
    const value = element.value.replace(/[^\d]/g, '');
    return parseFloat(value) || 0;
}

function updateCalculatedFields() {
    // 초기 투자금 기반 계산
    const initialInvestment = getNumericValue(document.getElementById('initialInvestment'));
    const insuranceReserve = initialInvestment * 0.1;
    const futuresSeed = initialInvestment * 0.9;

    document.getElementById('insuranceReserve').value = formatNumber(insuranceReserve, 0);
    document.getElementById('futuresSeed').value = formatNumber(futuresSeed, 0);

    // 1일 거래 횟수 = 승리 횟수 + 패배 횟수
    const winCount = parseInt(document.getElementById('winCount').value) || 0;
    const lossCount = parseInt(document.getElementById('lossCount').value) || 0;
    const dailyTrades = winCount + lossCount;

    document.getElementById('dailyTrades').value = dailyTrades;
}

function runSimulation() {
    // 입력값 가져오기
    const initialInvestment = getNumericValue(document.getElementById('initialInvestment'));
    const leverage = parseInt(document.getElementById('leverage').value);
    const winCount = parseInt(document.getElementById('winCount').value);
    const lossCount = parseInt(document.getElementById('lossCount').value);
    const days = parseInt(document.getElementById('days').value);

    // 새로운 설정값들
    const selfReferralRateInput = parseFloat(document.getElementById('selfReferralRate').value);
    const seedRateInput = parseFloat(document.getElementById('seedRate').value);
    const winProfitRateInput = parseFloat(document.getElementById('winProfitRate').value);
    const lossRateInput = parseFloat(document.getElementById('lossRate').value);
    const airdropPerDay = parseInt(document.getElementById('airdropPerDay').value);

    const selfReferralRate = selfReferralRateInput / 100;
    const seedRate = seedRateInput / 100;
    const winProfitRate = winProfitRateInput / 100;
    const lossRate = lossRateInput / 100;

    // 유효성 검사
    if (isNaN(initialInvestment) || initialInvestment < 100) {
        alert('초기 투자금은 100 USDT 이상이어야 합니다.');
        return;
    }

    if (isNaN(leverage) || leverage < 1 || leverage > 100) {
        alert('레버리지는 1-100 범위로 입력해 주세요.');
        return;
    }

    if (isNaN(winCount) || isNaN(lossCount) || winCount < 0 || lossCount < 0) {
        alert('승리/패배 횟수는 0 이상의 숫자여야 합니다.');
        return;
    }

    if (isNaN(days) || days < 1 || days > 365) {
        alert('시뮬레이션 기간은 1-365일 사이여야 합니다.');
        return;
    }

    if (isNaN(seedRateInput) || seedRateInput < 1 || seedRateInput > 100) {
        alert('시드 비율은 1-100% 범위로 입력해 주세요.');
        return;
    }

    if (isNaN(winProfitRateInput) || winProfitRateInput < 1 || winProfitRateInput > 100) {
        alert('익절률은 1-100% 범위로 입력해 주세요.');
        return;
    }

    if (isNaN(lossRateInput) || lossRateInput < 1 || lossRateInput > 100) {
        alert('손절률은 1-100% 범위로 입력해 주세요.');
        return;
    }

    // 로딩 표시
    document.getElementById('loading').classList.add('active');
    document.getElementById('resultsPanel').classList.remove('active');

    // 시뮬레이션 실행 (비동기 처리로 UI 업데이트)
    setTimeout(() => {
        const settings = new TradingSettings({
            initialInvestment,
            leverage,
            winCount,
            lossCount
        });

        // 커스텀 설정 적용
        settings.selfReferralRate = selfReferralRate;
        settings.seedRate = seedRate;
        settings.winProfitRate = winProfitRate;
        settings.lossRate = lossRate;
        settings.airdropPerDay = airdropPerDay;
        settings.dailyTrades = winCount + lossCount;

        const simulator = new TradingSimulator(settings, days);
        const results = simulator.runSimulation();

        // 결과 표시
        displayResults(results);

        // 로딩 숨기기
        document.getElementById('loading').classList.remove('active');
        document.getElementById('resultsPanel').classList.add('active');

        // 결과 패널로 스크롤
        document.getElementById('resultsPanel').scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

function createRowHTML(result) {
    const netPnlClass = result.netPnl >= 0 ? 'positive' : 'negative';
    const dailyPnlClass = result.dailyPnl >= 0 ? 'positive' : 'negative';

    return `
        <td>${result.day}</td>
        <td>${formatNumber(result.capitalPlusClaim, 0)}</td>
        <td>${formatNumber(result.startCapital, 0)}</td>
        <td>${formatNumber(result.cumulativeClaim, 0)}</td>
        <td>${formatNumber(result.seed, 2)}</td>
        <td>${result.winCount}</td>
        <td>${result.lossCount}</td>
        <td class="positive">${formatNumber(result.totalProfit, 2)}</td>
        <td class="negative">${formatNumber(result.totalLoss, 2)}</td>
        <td class="${dailyPnlClass}">${formatNumber(result.dailyPnl, 2)}</td>
        <td>${formatNumber(result.dailyFee, 2)}</td>
        <td>${formatNumber(result.selfReferral, 2)}</td>
        <td class="${netPnlClass}">${formatNumber(result.netPnl, 2)}</td>
        <td>${formatNumber(result.endCapital, 0)}</td>
        <td>${formatNumber(result.insuranceNodeCumulative, 2)}</td>
        <td>${result.newNodesToday}</td>
        <td>${formatNumber(result.carryoverLoss, 2)}</td>
        <td>${result.waitingNodes}</td>
        <td>${result.activeNodes}</td>
        <td>${result.expiredNodes}</td>
        <td>${result.newlyActivatedNodes}</td>
        <td class="positive">${formatNumber(result.todayAirdropTotal, 2)}</td>
        <td class="positive">${formatNumber(result.cumulativeAirdrop, 2)}</td>
        <td>${formatNumber(result.totalCapital, 0)}</td>
    `;
}

function loadMoreRows() {
    if (isLoading || currentDisplayIndex >= allResults.length) return;

    isLoading = true;
    const tbody = document.getElementById('resultsBody');

    // 기존 센티널 제거
    const existingSentinel = document.getElementById('scroll-sentinel');
    if (existingSentinel) {
        existingSentinel.remove();
    }

    const endIndex = Math.min(currentDisplayIndex + BATCH_SIZE, allResults.length);

    for (let i = currentDisplayIndex; i < endIndex; i++) {
        const row = document.createElement('tr');
        row.innerHTML = createRowHTML(allResults[i]);
        tbody.appendChild(row);
    }

    currentDisplayIndex = endIndex;

    // 더 로드할 데이터가 있으면 새 센티널 추가
    if (currentDisplayIndex < allResults.length) {
        const sentinel = document.createElement('tr');
        sentinel.id = 'scroll-sentinel';
        sentinel.style.height = '1px';
        tbody.appendChild(sentinel);

        // Observer 다시 연결
        if (observer) {
            observer.observe(sentinel);
        }
    }

    isLoading = false;
}

function setupScrollPagination() {
    // 기존 observer 정리
    if (observer) {
        observer.disconnect();
    }

    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                loadMoreRows();
            }
        });
    }, {
        rootMargin: '100px'
    });
}

function displayResults(results) {
    if (results.length === 0) return;

    // 전역 변수에 결과 저장
    allResults = results;
    currentDisplayIndex = 0;

    const finalResult = results[results.length - 1];
    const initialCapital = results[0].startCapital;

    // 요약 카드 업데이트 (소수점 제거)
    document.getElementById('finalCapital').innerHTML =
        formatNumber(finalResult.totalCapital, 0) + '<span class="unit">USDT</span>';

    const netProfit = finalResult.endCapital - initialCapital;
    const profitElement = document.getElementById('netProfit');
    profitElement.innerHTML = formatNumber(netProfit, 0) + '<span class="unit">USDT</span>';
    profitElement.className = 'value ' + (netProfit >= 0 ? 'positive' : 'negative');

    document.getElementById('totalAirdrop').innerHTML =
        formatNumber(finalResult.cumulativeAirdrop, 2) + '<span class="unit">USDT</span>';

    document.getElementById('activeNodes').innerHTML =
        finalResult.activeNodes + '<span class="unit">개</span>';

    // 테이블 초기화
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';

    // Intersection Observer 설정
    setupScrollPagination();

    // 첫 배치 로드
    loadMoreRows();
}

// 페이지 로드 및 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', function() {
    // 초기 계산값 업데이트
    updateCalculatedFields();

    // 초기 투자금 입력 필드 쉼표 포맷팅
    const initialInvestmentInput = document.getElementById('initialInvestment');

    initialInvestmentInput.addEventListener('input', function(e) {
        const cursorPosition = e.target.selectionStart;
        const oldValue = e.target.value;
        const oldLength = oldValue.length;

        // 쉼표 포맷 적용
        const formatted = formatNumberInput(e.target.value);
        e.target.value = formatted;

        // 커서 위치 조정 (쉼표 추가/제거 시)
        const newLength = formatted.length;
        const lengthDiff = newLength - oldLength;
        const newPosition = cursorPosition + lengthDiff;

        // 커서 위치 복원
        e.target.setSelectionRange(newPosition, newPosition);

        // 계산값 업데이트
        updateCalculatedFields();
    });

    // 승리/패배 횟수 변경 시
    document.getElementById('winCount').addEventListener('input', updateCalculatedFields);
    document.getElementById('lossCount').addEventListener('input', updateCalculatedFields);

    // 엔터키로 시뮬레이션 실행
    const inputs = document.querySelectorAll('input:not([readonly])');
    inputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                runSimulation();
            }
        });
    });
});
