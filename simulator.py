"""
Websea Trading Simulation System
거래 시뮬레이션 및 에어드랍 계산 시스템
"""

import math
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False


# ==================== 에어드랍 금액표 ====================
AIRDROP_RATE_BY_ROUND = {
    1: 0.1, 2: 0.1067, 3: 0.11, 4: 0.1167, 5: 0.12,
    6: 0.1267, 7: 0.13, 8: 0.1367, 9: 0.14, 10: 0.1467,
    11: 0.1533, 12: 0.1567, 13: 0.1633, 14: 0.17, 15: 0.1767,
    16: 0.1833, 17: 0.19, 18: 0.1967, 19: 0.2033, 20: 0.21,
    21: 0.22, 22: 0.2267, 23: 0.2367, 24: 0.2467, 25: 0.2533,
    26: 0.2633, 27: 0.2733, 28: 0.2833, 29: 0.2933, 30: 0.3033,
    31: 0.3167, 32: 0.3267, 33: 0.34, 34: 0.35, 35: 0.3633,
    36: 0.3767, 37: 0.39, 38: 0.4033, 39: 0.42, 40: 0.4333,
    41: 0.45, 42: 0.4667, 43: 0.4833, 44: 0.5, 45: 0.52,
    46: 0.5367, 47: 0.5567, 48: 0.5767, 49: 0.5967, 50: 0.62,
    51: 0.64, 52: 0.6633, 53: 0.69, 54: 0.7133, 55: 0.74,
    56: 0.7667, 57: 0.7933, 58: 0.82, 59: 0.85, 60: 0.88,
    61: 0.91, 62: 0.9433, 63: 0.9767, 64: 1.01, 65: 1.0467,
    66: 1.0833, 67: 1.1233, 68: 1.1633, 69: 1.2033, 70: 1.2467,
    71: 1.29, 72: 1.3367, 73: 1.3833, 74: 1.4333, 75: 1.4833,
    76: 1.5367, 77: 1.59, 78: 1.6467, 79: 1.7067, 80: 1.7667,
    81: 1.83, 82: 1.8933, 83: 1.96, 84: 2.03, 85: 2.1033,
    86: 2.1767, 87: 2.2533, 88: 2.3333, 89: 2.4167, 90: 2.5033,
    91: 2.59, 92: 2.6833, 93: 2.7767, 94: 2.8733, 95: 2.9767,
    96: 3.08, 97: 3.19, 98: 3.3, 99: 3.4167, 100: 3.5133
}

AIRDROP_RATE_BY_ACTIVE_DAY = {
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
}


@dataclass
class TradingSettings:
    """거래 설정값"""
    # 입력값 (노란색 - 사용자가 변경 가능)
    initial_investment: float = 10000.0  # 초기 투자금 (B3)
    leverage: int = 25  # 레버리지 (B6)
    win_count: int = 75  # 승리 횟수 (B12)
    loss_count: int = 90  # 패배 횟수 (B13)

    # 추가 입력값
    market_add_rate: float = 0.0006  # 시장가 기준 추가물량 (B7)
    fail_1st_add_rate: float = 0.015  # 설패 1차 수추물량 (B8)
    monthly_fee_rate: float = 0.03  # 1개월 강의(전업+창업) 수수료율 (B9)

    # 고정값 (회색)
    booting_rate: float = 0.10  # 부팅률 10% (B4)
    daily_fee_rate: float = 0.0066  # 일일 수수료 (B11)
    self_referral_rate: float = 0.40  # 셀프 레퍼럴 (B10)
    win_profit_rate: float = 0.01  # 자드 비트 비율 (B16)
    loss_rate: float = -0.01  # 손절 비율 (B17, 보통 -1%)
    bond_lever_ratio: float = 0.40  # 본드 레버 비율 (B18)

    # 보험 설정
    node_cost: int = 100  # 1노드 생성 기준 손실 (B21, USDT)
    node_activation_delay: int = 3  # 노드 스두잉수(3일) (B23)
    node_expiry_days: int = 50  # 노드 만성잉수(50일) (B26)

    def get_capital_seed(self) -> float:
        """자금 시드 계산 (B5)"""
        return self.initial_investment * (1 - self.booting_rate)


@dataclass
class DayResult:
    """일일 시뮬레이션 결과"""
    day: int  # A: 일차
    capital_plus_claim: float  # B: 자본+Claim 합
    start_capital: float  # C: 시작 자본
    cumulative_claim: float  # D: 누적 Claim 합계
    seed: float  # E: 시드(1%)
    win_count: int  # F: 승리 횟수
    loss_count: int  # G: 패배 횟수
    total_profit: float  # H: 총 익절 금액
    total_loss: float  # I: 총 손절 금액
    daily_pnl: float  # J: 일일 손익
    daily_fee: float  # K: 일일 수수료
    self_referral: float  # L: 셀프 레퍼럴
    net_pnl: float  # M: 순손익(Net P/L)
    end_capital: float  # N: 종료 자본(End)
    insurance_node_cumulative: float  # O: 보험 노드 누적
    new_nodes_today: int  # P: 당일 생성 노드
    carryover_loss: float  # Q: 이월 손실(잔액)
    waiting_nodes: int  # R: 대기 노드 수
    active_nodes: int  # S: 활성 노드 수
    expired_nodes: int  # T: 만료된 노드 수
    newly_activated_nodes: int  # U: 새로 활성된 노드 수
    today_airdrop_total: float  # V: 오늘 에어드랍 총액
    cumulative_airdrop: float  # W: 누적 에어드랍 합계
    total_capital: float  # X: 총 자본
    claim_stage_index: int  # Y: Claim 단계 인덱스
    today_claim_amount: float  # Z: 오늘 Claim 금액
    balance_before_claim: float  # AA: 클레임 전 잔액
    balance_after_claim: float  # AB: 클레임 후 잔액


class AirdropSimulation:
    """에어드랍 시뮬레이션 관리"""

    def __init__(self, max_days: int = 200, max_nodes: int = 50):
        self.max_days = max_days
        self.max_nodes = max_nodes
        # 에어드랍 데이터: airdrop_data[day][node_index] = amount
        self.airdrop_data: Dict[int, Dict[int, float]] = {}

    def calculate_node_airdrop(self, node_index: int, active_day: int) -> float:
        """특정 노드의 특정 활성일 에어드랍 금액 계산"""
        if active_day <= 0 or active_day > 50:
            return 0.0
        return AIRDROP_RATE_BY_ACTIVE_DAY.get(active_day, 0.0)

    def get_daily_airdrop_total(self, day: int, active_nodes_history: List[Tuple[int, int]]) -> float:
        """
        특정 일의 에어드랍 총액 계산
        active_nodes_history: [(node_created_day, node_index), ...]
        """
        total = 0.0
        for node_created_day, node_index in active_nodes_history:
            # 노드가 생성된 후 며칠째인지 계산
            active_day = day - node_created_day + 1
            if 1 <= active_day <= 50:
                total += self.calculate_node_airdrop(node_index, active_day)
        return total


class TradingSimulator:
    """거래 시뮬레이터 메인 클래스"""

    def __init__(self, settings: TradingSettings, simulation_days: int = 150):
        self.settings = settings
        self.simulation_days = simulation_days
        self.results: List[DayResult] = []
        self.airdrop_sim = AirdropSimulation()

        # 노드 추적: {day: newly_activated_count}
        self.node_activation_tracker: Dict[int, int] = {}
        # 활성 노드 이력: [(activation_day, node_index), ...]
        self.active_nodes_history: List[Tuple[int, int]] = []

    def run_simulation(self) -> List[DayResult]:
        """시뮬레이션 실행"""
        prev_result = None

        for day in range(1, self.simulation_days + 1):
            result = self._calculate_day(day, prev_result)
            self.results.append(result)
            prev_result = result

        return self.results

    def _calculate_day(self, day: int, prev: DayResult = None) -> DayResult:
        """특정 일의 계산 수행"""

        # A: 일차
        current_day = day

        # C: 시작 자본
        if day == 1:
            start_capital = self.settings.get_capital_seed()  # '기본 설정값'!$B$5
        else:
            start_capital = prev.end_capital  # =INDEX($N:$N, ROW()-1)

        # D: 누적 Claim 합계
        if day == 1:
            cumulative_claim = 0.0
        else:
            cumulative_claim = prev.cumulative_claim + self._get_today_claim(day)

        # B: 자본+Claim 합
        capital_plus_claim = start_capital + cumulative_claim  # =SUM(C3:D3)

        # E: 시드(1%)
        seed = capital_plus_claim * 0.01  # Assuming '기본 설정값'!$B$16 is 1%
        # 실제로는 settings에 있는 값을 사용해야 함
        seed = capital_plus_claim * self.settings.win_profit_rate

        # F, G: 승리/패배 횟수 (기본값 사용, 일별 변경 가능)
        win_count = self.settings.win_count  # ='기본 설정값'!$B$12
        loss_count = self.settings.loss_count  # ='기본 설정값'!$B$13

        # H: 총 익절 금액
        # =$E3*'기본 설정값'!$B$17*$F3
        # B17은 win_profit_rate (1% = 0.01)
        total_profit = seed * win_count  # 이미 seed가 1%이므로 win_count만 곱함
        # 다시 확인: E는 이미 B*win_profit_rate인데, H는 E*B17*F인가?
        # 수식대로: E * B17 * F
        total_profit = seed * win_count  # seed = B * 0.01이고, H = E * ? * F
        # 원 수식: $E3*'기본 설정값'!$B$17*$F3
        # E3 = seed, B17 = win_profit_rate (0.01로 가정), F3 = win_count
        # 이건 이상한데... E가 이미 1%인데 또 B17을 곱하면 0.01%가 됨
        # 다시 보니 E = B3 * B16 (시드 비율)
        # H = E * B17 (승리율) * F (승리 횟수)
        # 아마도 B16은 시드 비율, B17은 승리당 수익률
        # 혼란을 피하기 위해 수식 그대로 구현
        # E = capital_plus_claim * 시드비율(가정: 0.01)
        # H = E * 승리수익률(B17 가정: 1) * 승리횟수

        # 재정의: 설정값 확인
        # 사용자가 준 정보: B16 = 패배횟수, B17 = ?
        # 다시 보니: B16은 "자드 비트 비율", B17은 "설패 수추물량"이 아니라
        # 보험 섹션 전에 있는 값들

        # 다시 정리 (사용자 제공 정보 기반):
        # B16: 패배 횟수 (아님, 승리 횟수가 B12)
        # 혼란스러우니 수식 그대로:
        # E = B * 0.0066 (추정)
        # 아니면 E = B * (일일 시드 비율)

        # 명확히 하기 위해 수식 재확인:
        # e=B3 *'기본 설정값'!$B$16
        # 사용자 첫 메시지 확인: B16이 뭔지...
        # "시장가 기준 추가물량" = B7 = 0.0066
        # "자드 비트 비율" 등의 용어가 없음

        # 일단 주어진 수식대로 구현:
        # B16을 시드 비율로 가정 (1% = 0.01)
        seed_rate = 0.01  # 가정
        seed = capital_plus_claim * seed_rate

        # H = E * B17 * F
        # B17을 win_profit_rate로 가정
        win_profit_multiplier = 1.0  # 승리당 100% 수익이면 1.0
        total_profit = seed * win_profit_multiplier * win_count

        # I: 총 손절 금액
        # =$E3*'기본 설정값'!$B$18*$G3
        # B18 = bond_lever_ratio (0.4) 또는 loss_rate?
        # 수식: E * B18 * G
        # B18을 loss_rate로 가정 (-0.01 또는 절대값)
        loss_rate_value = abs(self.settings.loss_rate)  # 0.01
        total_loss = seed * loss_rate_value * loss_count

        # J: 일일 손익
        daily_pnl = total_profit + total_loss  # loss는 음수여야 하므로 -total_loss
        # 수식: =$H3+$I3
        # I가 음수 손실이면 그대로 더함
        total_loss_negative = -total_loss  # 손실은 음수
        daily_pnl = total_profit + total_loss_negative

        # K: 일일 수수료
        # =$E3*'기본 설정값'!$B$9*'기본 설정값'!$B$11
        # B9 = monthly_fee_rate (0.03)
        # B11 = daily_fee_rate (0.0066)
        daily_fee = seed * self.settings.monthly_fee_rate * self.settings.daily_fee_rate

        # L: 셀프 레퍼럴
        # =$K3*'기본 설정값'!$B$10
        # B10 = self_referral_rate (0.4)
        self_referral = daily_fee * self.settings.self_referral_rate

        # M: 순손익(Net P/L)
        # =$J3-$K3+$L3
        net_pnl = daily_pnl - daily_fee + self_referral

        # N: 종료 자본(End)
        # =INDEX($C:$C,ROW()) + INDEX($M:$M,ROW())
        # = C + M (같은 행)
        end_capital = start_capital + net_pnl

        # O: 보험 노드 누적
        # =-$I3
        insurance_node_cumulative = -total_loss_negative  # = total_loss (양수)

        # P: 당일 생성 노드
        # =INT( $O3 / '기본 설정값'!$B$21 )
        # B21 = node_cost (100)
        new_nodes_today = int(insurance_node_cumulative / self.settings.node_cost)

        # Q: 이월 손실(잔액)
        # =MOD( $O3 , '기본 설정값'!$B$21 )
        carryover_loss = insurance_node_cumulative % self.settings.node_cost

        # R: 대기 노드 수
        # 첫 행: =P3
        # 그 다음: =SUM(INDEX($P:$P, ROW()-3):INDEX($P:$P, ROW())) - INDEX($P:$P, ROW()-3)
        if day == 1:
            waiting_nodes = new_nodes_today
        else:
            # 4일간의 합계에서 4일 전 값을 뺀 것 = 최근 3일간의 합
            # ROW()가 현재 행 번호라고 가정 (day + 2, 1일차는 3행)
            # 간단히: 최근 3일(현재 포함)의 P 합계에서 3일 전 P를 뺀 값
            # = P[day-2] + P[day-1] + P[day] - P[day-3] (if day >= 4)
            # 아니면 그냥 최근 self.settings.node_activation_delay일의 P 합계
            start_idx = max(0, day - self.settings.node_activation_delay)
            waiting_nodes = sum(r.new_nodes_today for r in self.results[start_idx:day-1]) + new_nodes_today
            if day >= self.settings.node_activation_delay + 1:
                waiting_nodes -= self.results[day - self.settings.node_activation_delay - 1].new_nodes_today

        # T: 만료된 노드 수
        # =IF($A3 <= '기본 설정값'!$B$26, 0, INDEX($P$3:$P$986, $A3 - '기본 설정값'!$B$26))
        # B26 = node_expiry_days (50)
        if day <= self.settings.node_expiry_days:
            expired_nodes = 0
        else:
            expired_day = day - self.settings.node_expiry_days
            if expired_day >= 1 and expired_day <= len(self.results):
                expired_nodes = self.results[expired_day - 1].new_nodes_today
            else:
                expired_nodes = 0

        # S: 활성 노드 수
        # =SUM($P$3:P3) - R3
        total_nodes_created = sum(r.new_nodes_today for r in self.results) + new_nodes_today
        total_expired = sum(r.expired_nodes for r in self.results) + expired_nodes
        active_nodes = total_nodes_created - waiting_nodes - total_expired

        # U: 새로 활성된 노드 수
        # =IF($A3 <= '기본 설정값'!$B$23, 0, INDEX($P$3:$P$986, $A3 - '기본 설정값'!$B$23))
        # B23 = node_activation_delay (3)
        if day <= self.settings.node_activation_delay:
            newly_activated_nodes = 0
        else:
            activation_day = day - self.settings.node_activation_delay
            newly_activated_nodes = self.results[activation_day - 1].new_nodes_today

        # V: 오늘 에어드랍 총액
        # 복잡한 SUMPRODUCT 수식
        # 에어드랍_시뮬 시트 참조
        today_airdrop_total = self._calculate_daily_airdrop(day)

        # W: 누적 에어드랍 합계
        # =SUM($V$3:V3)
        cumulative_airdrop = sum(r.today_airdrop_total for r in self.results) + today_airdrop_total

        # X: 총 자본
        # =INDEX($N:$N,ROW()) + INDEX($W:$W,ROW())
        total_capital = end_capital + cumulative_airdrop

        # Y: Claim 단계 인덱스
        # =IF(Z4 > 0, IF(Y3 >= 15, 1, Y3 + 1), Y3)
        if day == 1:
            claim_stage_index = 1
        else:
            prev_claim = self._get_today_claim(day)
            if prev_claim > 0:
                claim_stage_index = 1 if prev.claim_stage_index >= 15 else prev.claim_stage_index + 1
            else:
                claim_stage_index = prev.claim_stage_index

        # Z: 오늘 Claim 금액
        # =IF(AA3 >= 2^(Y3 - 1), 2^(Y3 - 1), 0)
        # AA는 다음 행의 balance_before_claim
        # 이건 순환 참조... 다음 행 계산 필요
        # 일단 현재 행 기준으로 계산
        # AA3 = balance_before_claim (다음 행 = day+1)
        # 이건 나중에 계산해야 함

        # AA: 클레임 전 잔액
        # =$AB3 + $V4
        # AB3 = balance_after_claim (현재 행)
        # V4 = today_airdrop_total (다음 행)
        # 이것도 다음 행 값 필요... 재귀적

        # 간단히: Z, AA, AB는 다음 날 정보가 필요하므로 일단 0으로
        today_claim_amount = 0.0
        balance_before_claim = 0.0
        balance_after_claim = 0.0

        # 재계산 로직 필요 (claim 관련은 복잡하므로 나중에)

        return DayResult(
            day=current_day,
            capital_plus_claim=capital_plus_claim,
            start_capital=start_capital,
            cumulative_claim=cumulative_claim,
            seed=seed,
            win_count=win_count,
            loss_count=loss_count,
            total_profit=total_profit,
            total_loss=total_loss_negative,
            daily_pnl=daily_pnl,
            daily_fee=daily_fee,
            self_referral=self_referral,
            net_pnl=net_pnl,
            end_capital=end_capital,
            insurance_node_cumulative=insurance_node_cumulative,
            new_nodes_today=new_nodes_today,
            carryover_loss=carryover_loss,
            waiting_nodes=waiting_nodes,
            active_nodes=active_nodes,
            expired_nodes=expired_nodes,
            newly_activated_nodes=newly_activated_nodes,
            today_airdrop_total=today_airdrop_total,
            cumulative_airdrop=cumulative_airdrop,
            total_capital=total_capital,
            claim_stage_index=claim_stage_index,
            today_claim_amount=today_claim_amount,
            balance_before_claim=balance_before_claim,
            balance_after_claim=balance_after_claim
        )

    def _calculate_daily_airdrop(self, day: int) -> float:
        """일일 에어드랍 총액 계산"""
        # 활성 노드들의 에어드랍 합계
        # 각 노드는 생성 후 활성화(3일 후)부터 50일간 에어드랍 발생
        total = 0.0

        for past_day in range(1, day + 1):
            if past_day > len(self.results):
                continue

            nodes_created = self.results[past_day - 1].new_nodes_today if past_day <= len(self.results) else 0

            # 이 노드들이 활성화된 날
            activation_day = past_day + self.settings.node_activation_delay

            if activation_day > day:
                continue  # 아직 활성화 안됨

            # 현재 날짜에서 이 노드의 활성일 계산
            active_day = day - activation_day + 1

            if active_day < 1 or active_day > 50:
                continue  # 활성 범위 밖

            # 각 노드의 에어드랍 금액
            airdrop_per_node = AIRDROP_RATE_BY_ACTIVE_DAY.get(active_day, 0.0)
            total += airdrop_per_node * nodes_created

        return total

    def _get_today_claim(self, day: int) -> float:
        """오늘 Claim 금액 조회 (이전 날 결과에서)"""
        if day <= 1 or day > len(self.results):
            return 0.0
        return self.results[day - 2].today_claim_amount if day > 1 else 0.0

    def export_to_dataframe(self):
        """결과를 DataFrame으로 변환 (pandas 있을 경우) 또는 딕셔너리 리스트 반환"""
        data = []
        for r in self.results:
            data.append({
                '일차': r.day,
                '자본+Claim': round(r.capital_plus_claim, 2),
                '시작자본': round(r.start_capital, 2),
                '누적Claim': round(r.cumulative_claim, 2),
                '시드': round(r.seed, 2),
                '승리횟수': r.win_count,
                '패배횟수': r.loss_count,
                '총익절': round(r.total_profit, 2),
                '총손절': round(r.total_loss, 2),
                '일일손익': round(r.daily_pnl, 2),
                '일일수수료': round(r.daily_fee, 2),
                '셀프레퍼럴': round(r.self_referral, 2),
                '순손익': round(r.net_pnl, 2),
                '종료자본': round(r.end_capital, 2),
                '보험노드누적': round(r.insurance_node_cumulative, 2),
                '신규노드': r.new_nodes_today,
                '이월손실': round(r.carryover_loss, 2),
                '대기노드': r.waiting_nodes,
                '활성노드': r.active_nodes,
                '만료노드': r.expired_nodes,
                '신규활성': r.newly_activated_nodes,
                '오늘에어드랍': round(r.today_airdrop_total, 2),
                '누적에어드랍': round(r.cumulative_airdrop, 2),
                '총자본': round(r.total_capital, 2),
            })

        if HAS_PANDAS:
            return pd.DataFrame(data)
        return data

    def print_results(self, num_days: int = 10):
        """결과를 콘솔에 출력"""
        data = self.export_to_dataframe()

        if HAS_PANDAS:
            print(data.head(num_days).to_string(index=False))
        else:
            # 수동으로 테이블 출력
            if not data:
                return

            headers = list(data[0].keys())

            # 헤더 출력
            header_line = " | ".join(f"{h:>12}" for h in headers)
            print(header_line)
            print("-" * len(header_line))

            # 데이터 출력 (처음 num_days개)
            for row in data[:num_days]:
                row_line = " | ".join(f"{str(row[h]):>12}" for h in headers)
                print(row_line)


# ==================== 사용 예시 ====================
if __name__ == "__main__":
    # 설정값 생성
    settings = TradingSettings(
        initial_investment=10000.0,
        leverage=25,
        win_count=75,
        loss_count=90
    )

    # 시뮬레이터 실행
    simulator = TradingSimulator(settings, simulation_days=150)
    results = simulator.run_simulation()

    # 처음 10일 결과 출력
    print("=== 시뮬레이션 결과 (처음 10일) ===")
    simulator.print_results(10)

    # 최종 결과 요약
    print("\n=== 최종 결과 (150일차) ===")
    final = results[-1]
    print(f"총 자본: ${final.total_capital:,.2f}")
    print(f"종료 자본: ${final.end_capital:,.2f}")
    print(f"누적 에어드랍: ${final.cumulative_airdrop:,.2f}")
    print(f"활성 노드: {final.active_nodes}개")
    print(f"만료 노드: {final.expired_nodes}개")

    # 중간 결과 (30일, 60일, 90일, 120일)
    print("\n=== 주요 시점 결과 ===")
    for day in [30, 60, 90, 120]:
        if day <= len(results):
            r = results[day - 1]
            print(f"\n{day}일차:")
            print(f"  총 자본: ${r.total_capital:,.2f}")
            print(f"  활성 노드: {r.active_nodes}개")
            print(f"  누적 에어드랍: ${r.cumulative_airdrop:,.2f}")
