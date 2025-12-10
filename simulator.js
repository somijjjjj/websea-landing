// Websea Trading Simulator - JavaScript Version
// 거래 시뮬레이션 및 에어드랍 계산

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
        this.selfReferralRate = 0.40;
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

function runSimulation() {
    // 입력값 가져오기
    const initialInvestment = parseFloat(document.getElementById('initialInvestment').value);
    const leverage = parseInt(document.getElementById('leverage').value);
    const winCount = parseInt(document.getElementById('winCount').value);
    const lossCount = parseInt(document.getElementById('lossCount').value);
    const days = parseInt(document.getElementById('days').value);

    // 유효성 검사
    if (isNaN(initialInvestment) || initialInvestment < 100) {
        alert('초기 투자금은 100 USDT 이상이어야 합니다.');
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

function displayResults(results) {
    if (results.length === 0) return;

    const finalResult = results[results.length - 1];
    const initialCapital = results[0].startCapital;

    // 요약 카드 업데이트
    document.getElementById('finalCapital').innerHTML =
        formatNumber(finalResult.totalCapital) + '<span class="unit">USDT</span>';

    const netProfit = finalResult.endCapital - initialCapital;
    const profitElement = document.getElementById('netProfit');
    profitElement.innerHTML = formatNumber(netProfit) + '<span class="unit">USDT</span>';
    profitElement.className = 'value ' + (netProfit >= 0 ? 'positive' : 'negative');

    document.getElementById('totalAirdrop').innerHTML =
        formatNumber(finalResult.cumulativeAirdrop) + '<span class="unit">USDT</span>';

    document.getElementById('activeNodes').innerHTML =
        finalResult.activeNodes + '<span class="unit">개</span>';

    // 테이블 업데이트 (마지막 10일)
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';

    const displayResults = results.slice(-10);

    displayResults.forEach(result => {
        const row = document.createElement('tr');

        const netPnlClass = result.netPnl >= 0 ? 'positive' : 'negative';

        row.innerHTML = `
            <td>${result.day}</td>
            <td>${formatNumber(result.startCapital)}</td>
            <td>${formatNumber(result.endCapital)}</td>
            <td class="${result.dailyPnl >= 0 ? 'positive' : 'negative'}">${formatNumber(result.dailyPnl)}</td>
            <td class="${netPnlClass}">${formatNumber(result.netPnl)}</td>
            <td class="positive">${formatNumber(result.cumulativeAirdrop)}</td>
            <td>${result.activeNodes}</td>
        `;

        tbody.appendChild(row);
    });
}

// 엔터키로 시뮬레이션 실행
document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                runSimulation();
            }
        });
    });
});
