# 값 추정 방식 레퍼런스 — 실시간 모델 추론 vs 실측 통계(comps) (재사용 가능한 패턴)

사용자에게 추정값(가격·평가·추천 등)을 보여줄 때, **실시간 모델 추론**과 **과거 실측 데이터의 통계치(comps 기반)** 중 무엇을 쓸지 판단하는 재사용 가능한 프레임워크. 가격 추정을 주 예시로 삼지만, 원칙 자체는 추천·평가·수요예측 등 "값 하나(또는 범위)를 추정해 보여주는" 다른 도메인에도 그대로 적용된다.

**quantile regression 같은 개별 ML 기법 자체의 상세 설명은 이 문서 몫이 아니다** — 그건 `ml-expert` 에이전트에게 물어본다. 이 문서는 "어떤 상황에 어떤 방식을 선택할지"라는 더 상위의 판단 기준만 다룬다.

## 1. 두 방식의 정의

- **실시간 모델 추론(live model inference)**: 입력이 들어올 때마다 학습된 모델이 그 자리에서 연산해 값을 산출한다. 점추정 모델(회귀)은 값 하나만 내놓고, "범위"까지 필요하면 quantile regression·conformal prediction 같은 별도 방법론이 추가로 필요하다.
- **실측 통계(comps) 기반**: 비교 가능한 과거 실제 거래·기록을 모아 그 분포(중앙값·범위·평균 등)를 그대로 보여준다. 모델을 학습하지 않고도 "범위"를 자연스럽게 얻을 수 있다 — 범위가 곧 실제 관측치의 분산이기 때문이다.
- **하이브리드**: 실무에서는 이 둘이 배타적이지 않다 — comps 데이터를 모델의 피처로 넣거나(아래 Zestimate 사례), 모델 예측을 comps로 보정하는 식으로 섞어 쓰는 경우가 흔하다.

## 2. 실무 사례 비교(WebSearch로 확인한 근거만)

| 서비스 | 방식 | 확인된 내용 |
|---|---|---|
| **Zillow Zestimate** | 하이브리드 (신경망 모델 + comps를 피처로 흡수) | 공식 문서가 "expert-driven economic modeling과 data-driven predictive machine learning의 결합"이라고 명시. 최근엔 신경망("Neural Zestimate")을 쓰며, 그 핵심 입력 중 하나가 인근 유사 매물("peer homes") 4~5개의 실제 거래가 — 즉 comps를 모델이 피처로 흡수하는 구조다. 신규 매물·시장 데이터가 들어올 때마다 갱신된다. |
| **Airbnb Smart Pricing** | 순수 실시간 모델 추론 | Random Forest 기반(선형이 아닌 가격 패턴 대응). 예약 속도·검색 활동·경쟁 숙소 가격 변동·지역 이벤트를 실시간으로 모니터링해 계속 재계산 — "멈추지 않는" 상시 추론 시스템. Kafka(실시간 스트림)·Spark(배치)·Cassandra 등 스트리밍 인프라를 갖춰야 하는, 인프라 투자가 큰 방식의 대표 사례. |
| **부동산 CMA(전통 방식)** | 순수 comps/통계 | 공인중개사가 유사 매물 3~5개를 뽑아 그 실제 거래가로 범위를 산출 — 모델 없이도 성립하는, 지금도 AVM과 나란히 쓰이는 업계 표준 방법. 특이하거나 비표준적인 매물엔 AVM보다 CMA가 더 정확하다는 게 업계 컨센서스. |
| **Kelley Blue Book(KBB)** | 통계/분석 중심 하이브리드 | 도매 경매·딜러 거래·개인간 거래 등 실제 거래 데이터(월 약 50만 건)를 "predictive analytics"로 분석해 지역별·주간 단위로 값을 갱신 — 매 요청마다 실시간 추론하는 게 아니라 **주기적 배치 분석**에 더 가깝다. 실시간 모델 추론도, 단순 comps 나열도 아닌 제3의 배치형 통계 방식. |
| **eBay "유사 판매완료 상품"** | 순수 comps/통계 | 최근 90일(무료) ~ 최대 1~3년(Terapeak 유료)의 실제 판매완료가를 모아 평균가·가격대·판매율을 계산해 보여준다 — 모델 추론이 전혀 없는, 실측 데이터 그 자체를 통계로 요약하는 가장 단순한 형태. "Sold"(실제 팔린 가격)와 "Completed"(안 팔린 가격 포함)를 구분해서 보여주는 것도 특징. |
| **StockX** | 실시간 시장 데이터(오더북) — 모델 추론도 comps 통계도 아닌 제3의 범주 | 증권거래소 방식의 실시간 입찰가·낙찰가(bid-ask) 매칭 엔진. "가격"이 예측값이 아니라 **그 순간의 실제 시장 데이터 자체**다. 공식 프라이싱 알고리즘 문서는 비공개 — 외부 연구자들이 StockX 데이터로 별도 예측 모델(Random Forest, XGBoost)을 만든 사례는 있지만, 이는 StockX 자체 서비스 로직이 아니라 그 데이터를 가지고 한 별개 연구다. |

## 3. 놓치기 쉬운 제3의 범주 — "실시간"이 곧 "모델 추론"은 아니다

StockX 사례가 보여주듯, **"실시간으로 값이 바뀐다"는 것과 "모델이 그 값을 예측한다"는 것은 서로 다른 축이다.** StockX의 가격은 그 순간의 실제 입찰·낙찰 기록이지 어떤 모델이 추론한 값이 아니다 — 그런데도 참여자 입장에서는 "즉각 반응하는 AI스러운 가격"처럼 보일 수 있다. 어떤 서비스가 사진을 올리자마자 즉시 반응했다고 해서, 그 즉시성 자체가 "실시간 모델 추론을 쓴다"는 증거는 아니다 — 이미지 인식처럼 실제로 모델이 필요한 단계와, 그 인식 결과로 실측 데이터를 그 자리에서 조회(retrieval)하는 단계가 섞여 있을 수 있다. 특정 서비스의 내부 구조를 추측할 땐 이 둘을 구분해서, 확인 안 된 부분은 확인 안 됐다고 명시한다(아래 4-1절 원칙).

## 4. 각 방식이 유리한 조건

- **comps/통계가 유리**: 비교 대상이 몇 건만 있어도 충분하고, 상품이 특이하거나 표준화돼 있지 않을 때(부동산 CMA가 AVM보다 특이 매물에 강한 이유). 새로 모델을 학습·서빙할 인프라 투자 없이도 "범위"까지 자연스럽게 얻을 수 있다는 것도 장점.
- **모델 추론이 유리**: 표준화된 상품·거래가 많고 비교 데이터가 풍부할 때, 그리고 **수요·경쟁 상황처럼 과거 데이터만으론 못 보는 실시간 신호를 반영해야 할 때**(Airbnb가 예약 속도·검색 활동까지 실시간으로 모니터링하는 이유).
- **하이브리드가 오히려 흔하다**: Zestimate·KBB 둘 다 "모델/분석이 comps 데이터를 흡수하는" 구조다 — 실무에서는 순수 이분법보다 이 스펙트럼 중간(comps를 모델 피처로 쓰거나, 모델 결과를 comps로 보정)이 더 자주 관찰된다. "우리는 comps만 쓴다"가 반드시 원시적인 선택은 아니라는 뜻이기도 하다.

### 4-1. 확인 안 된 것을 확인됐다고 서술하지 않는다

어떤 서비스가 실제로 어떤 방식을 쓰는지는 공식 문서로 확인되지 않는 경우가 많다(위 표의 StockX가 그 예). 다음 프로젝트에서 특정 서비스를 근거로 인용할 때:

- 공식 문서·기술 블로그로 확인된 것만 "확인됨"으로 쓴다.
- 화면 관찰만으로 내부 구조를 추측했다면(예: "범위가 뜨니까 아마 comps 방식일 것") 그렇게 명시하고, 그 추측을 사용자에게 검증도 없이 단정적으로 전달하지 않는다 — 사용자가 그 서비스를 실제로 써본 경험이 있다면 그 직접 경험이 훨씬 강한 근거이므로, 추측과 실제 경험이 부딪히면 추측을 먼저 접는다.

## 5. 판단 체크리스트

다음 프로젝트에서 "이 값을 어떻게 산출할까" 결정할 때 스스로 점검한다:

- [ ] 비교 가능한 실측 데이터가 몇 건이나 있는가 — 몇 건 안 되면 모델 학습 자체가 무의미할 수 있다(comps 방식으로 기울 신호).
- [ ] 범위(구간)까지 필요한가, 단일값이면 충분한가 — 범위가 필요한데 점추정 모델만 있다면, comps의 실측 분산을 쓰거나 quantile regression/conformal prediction 같은 별도 방법론을 새로 도입해야 한다(비용 발생).
- [ ] 과거 데이터만으론 못 보는 실시간 신호(수요·경쟁·이벤트 등)를 반영해야 하는가 — 그렇다면 모델 추론 쪽이 유리하다.
- [ ] 실시간 추론 인프라(서빙·스트리밍·재학습 파이프라인)를 새로 구축할 여유가 있는가 — 파일럿/소규모 프로젝트라면 이 비용 자체가 comps 방식을 선택할 충분한 이유가 된다.
- [ ] 대상이 표준화된 상품인가, 특이/비표준 상품인가 — 표준화가 덜 될수록 comps가 유리하다.
- [ ] "실시간으로 반응한다"는 관찰이 있다면, 그게 정말 모델 추론 때문인지 아니면 실측 데이터를 그 자리에서 조회(retrieval)하는 것뿐인지 구분했는가(3절).

## 근거

- [How is the Zestimate® calculated? – Zillow Help Center](https://zillow.zendesk.com/hc/en-us/articles/4402325964563-How-is-the-Zestimate-calculated)
- [Building the Neural Zestimate - Zillow Tech Hub](https://www.zillow.com/tech/building-the-neural-zestimate/)
- [Unlocking the Secrets: How Zillow's Algorithm Transforms Real Estate Predictions and Valuations](https://locall.host/what-algorithm-does-zillow-use/)
- [How Airbnb Uses Machine Learning for Price Optimization](https://www.brainforge.ai/blog/how-airbnb-uses-machine-learning-for-price-optimization)
- [Airbnb's Dynamic Pricing Strategy - Product Analytics Case Study](https://hellopm.co/airbnbs-dynamic-pricing-strategy-product-analytics-case-study/)
- [CMA vs. Automated Valuation Models](https://batchdata.io/blog/cma-vs-automated-valuation-models)
- [Automated valuation model — Wikipedia](https://en.wikipedia.org/wiki/Automated_valuation_model)
- [Broker Price Opinion vs. Comparative Market Analysis vs. Automated Valuation Model vs. Appraisal](https://www.trautmanagency.com/blog/broker-price-opinion-vs-comparative-market-analysis-vs-automated-valuation-model-vs-appraisal-whats-the-difference)
- [Kelley Blue Book Used Pricing Guide](https://www.usedcars.com/kelley-blue-book-used-pricing-guide)
- [Kelley Blue Book pricing: Explained + Real Accuracy Data](https://originalpricing.com/kelley-blue-book-pricing/)
- [Product research | eBay](https://www.ebay.com/help/selling/selling-tools/product-research?id=4853)
- [eBay Sold Listings: How to Find Sold Prices](https://www.underpriced.app/blog/how-to-use-ebay-sold-listings-price-research-guide)
- [What is StockX and How Does It Work?](https://miracuves.com/blog/what-is-stockx-and-how-does-it-work/)
- [Predicting StockX Sneaker Prices With Machine Learning](https://medium.com/swlh/predicting-stockx-sneaker-prices-with-machine-learning-ec9cb625bec0)(StockX 자체 서비스 로직이 아니라 외부 연구임을 유의)
