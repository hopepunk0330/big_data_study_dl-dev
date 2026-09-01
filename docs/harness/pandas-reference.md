# 📀 판다스 레퍼런스 (개인 학습 노트 기반)

> 이 문서는 Notion에 정리해온 판다스 학습 노트(`📀 판다스` 페이지)를 그대로 재구성한 개인 레퍼런스입니다.
> 목적: 이후 pandas-expert 에이전트가 "일반적인 pandas 튜토리얼"이 아니라 **내가 실제로 써온 방식/습관/규칙**에 맞춰 힌트를 주도록 하는 기준 문서.
> 원본 노트의 순서와 표현을 최대한 유지했고, 최신 pandas(3.0.3, 이 프로젝트에 설치된 버전)와 어긋나거나 다시 봐야 할 부분은 **"⚠️ 확인 필요"**로 표시했습니다.

---

## 0. 환경 설정

### 가상환경 (venv)
- venv: Python 프로젝트마다 독립된 패키지 환경을 만들어주는 표준 모듈. 프로젝트별로 라이브러리 버전 충돌 없이 쓰기 위한 도구.

```bash
# 파이썬 설치 (외부 -> 가상환경은 복사하는 개념)
brew install python@3.12

# 파이썬 숨겨진 버전 확인
brew list | grep python

# 가상환경에서 파이썬 버전 지정 설치 (내부로 복사 개념)
python3.12 -m venv venv

# 가상환경 활성화
source ./venv/bin/activate

# (venv) 상태에서 파이썬 버전 확인
python --version

# 가상환경 안 설치 목록 보기
ls ./venv/bin

# 가상환경 비활성화
deactivate
```

### 판다스 설치
```bash
pip install pandas numpy pyarrow

pip list

python -c "import pandas as pd; print(pd.__version__)"
```

### 개인 메모
- 엑셀 파일을 주고받을 때: 저장할 때 **유니코드로 저장해달라고 요청해야 호환됨** (한글 깨짐 방지).
- 데이터 흐름 요약: `to_csv() → orders.csv → read_csv()`
- `pip install` 할 때 `pyarrow`를 항상 같이 설치 — parquet 사용을 염두에 둔 습관.

---

## 1. 데이터 훑어보기 (탐색)

> 분석 전, 규모·타입·결측·이상값을 먼저 "정찰"하는 단계. 구조, 결측, 기본 통계치를 본다.

**⭐️ 테이블 하나 훑어볼 때 자주 쓰는 것들**
- `df.info()` — 컬럼명, dtype, null 개수를 한눈에
- `df.head()` — 실제 값 몇 줄 보기
- `df.columns` — 컬럼 목록만
- `df.describe()` — 숫자 컬럼 분포(min/max/평균 등)
- `df["status"].value_counts()` — 카테고리 컬럼에 어떤 값이 몇 개씩 있는지
- `df["order_id"].nunique()` — 고유값 개수 (이 컬럼이 진짜 key인지 확인할 때)

**⭐️ 테이블 간 관계(사실상의 ERD) 확인법**
- `orders["order_id"].isin(order_items["order_id"]).all()` → "모든 order_items가 orders에 짝이 있나?" 확인
- `merge(..., indicator=True)` 로 조인했을 때 `left_only`/`right_only`/`both` 개수를 보면 관계가 1:1인지 1:N인지 감이 옴

| 도구 | 내용 |
|---|---|
| `Series` | 컬럼 하나만 추출한 것 — (index, values)로 구성되어 인덱스값/밸류값만 따로 추출 가능 |
| `DataFrame` | 컬럼 하나만 추출 가능 |
| `head()` / `tail()` | 앞 / 뒤 몇 행 확인 |
| `shape[0]` | 행·열 수. 행 개수만 뽑을 때 (# 행수 = 건수) |
| `info()` | 데이터프레임 정보 추출. 각 열 이름·비결측 개수·dtype·메모리를 한 번에. **결측 파악의 핵심.** ⭐️ 결측치 = 총 데이터 - null이 아닌 값(0이면 null 없음) |
| `describe()` | 통계치 (int만 출력, str은 미출력). 합/평균/최대/최소/표준편차(분산)/사분위. 표준편차=데이터가 평균에서 퍼진 정도, 산포도, 정규분포를 따른다=예측이 믿을만함(중위값과 평균값 차이가 크면 한쪽으로 치우침) |
| `value_counts()` | 값의 개수 확인 (내림차순 정렬돼서 나옴) |
| `unique()` | 종류 보기 (행별 값) |
| `nunique()` | 종류의 개수 (중복 제거) |

### 사용 예
```python
orders.info()   # order_datetime 값이 전체 행수보다 적으면 결측 발생

order_items_df[['quantity', 'unit_price', 'discount']].describe()

products_df['category'].value_counts()

products_df['category'].unique()
print(products_df['category'].nunique())

customers_df.isna().sum()                    # 전체 컬럼 결측 개수
customers_df.isna().sum()['email']            # 특정 컬럼만
customers_df.isna().sum()[['gender','email']]  # 여러 컬럼만
customers_df['birth_date'].isna().sum()        # True=1, False=0 → sum()=True 개수
```

---

## 2. 데이터 선택과 인덱싱

> 꺼내는 데 사용: **loc**(라벨) / **iloc**(위치) → 행 단위. 열을 지정해서 함께 조회. 한 개만 나오면 Series.

| 도구 | 내용 | 사용법 | 방식 |
|---|---|---|---|
| `loc[]` | 라벨 기반: 문자 접근 | `df.loc[행라벨, 열이름]` → `df.loc["홍길동", '컬럼명']` ⇒ 숫자도 가능(모든 열 나옴) | 행 기준 추출 후 → 열 추출 |
| `iloc[]` | 위치 기반: 숫자 접근(integer) | `df.iloc[행위치, 열위치]` → `df.iloc[0, 1]` ⇒ 숫자만 가능 (-1은 마지막 행) | |
| `datetime` / `to_datetime()` | str을 날짜 타입으로 변환(파싱) | 1) `parse_dates=['order_datetime']` (read_csv에서) 또는 2) `.to_datetime()` | |
| `.dt.month` `.dt.year` | | `.dt.month == 6` → 6월만 꺼내기 | |

> `df['col']` : 컬럼명 하나 → Series, `df[['a','b']]` : 리스트로 여러 컬럼 추출 → DataFrame (순서: 행 추출 후 컬럼 추출), 조건 자리에는 참/거짓 시리즈가 들어감

### ⚠️ 확인 필요 / 중요 캐치
- **`loc`는 끝 값을 포함**, **`iloc`는 끝 값을 미포함**한다는 것을 직접 실험으로 확인해 둠:
  - `orders_df.loc[0:5]` → 0부터 5까지 **값으로** 뽑아서 6행 나옴
  - `orders_df.iloc[0:5]` → 0부터 5 직전까지(start~end-1) 뽑아서 5행 나옴
  - 이 둘의 차이를 항상 헷갈리지 않도록 강조해서 적어둔 부분 — 실제로 자주 헷갈리는 포인트이므로 계속 의식할 것.

### 사용 예
```python
orders_df = pd.read_csv(
    '../data/orders.csv',
    parse_dates=['order_datetime']    # str 컬럼을 datetime64로 변환
)
orders_df.loc[0:5]    # 6행 (라벨 포함)
orders_df.iloc[0:5]   # 5행 (위치, exclusive)

# iloc[행, 열] 조합
customers_df.iloc[0:3, [1,5]]
customers_df.iloc[0:3, [1,-2]]
customers_df.loc[0:2, ['name','city']]

# 특정 열을 인덱스로 보내고 loc로 값 1개 추출
p_id_df = products_df.set_index('product_id')
p_id_df.loc[95]              # 95번 상품 (Series)
p_id_df.loc[95]['category']  # 거기서 컬럼값만 체이닝으로 추출
```

---

## 3. 인덱스 바꾸기, 정렬

| 메서드 | 내용 |
|---|---|
| **set_index / reset_index** | 의미 있는 컬럼을 행 index로 삼기 |
| `.set_index('열')` | 지정한 열을 행 인덱스(라벨)로 올림 |
| `.reset_index()` | 인덱스를 다시 기본 정수 인덱스로 되돌림 |
| **sort_values / sort_index** | 날짜 기간 슬라이싱과 연결됨. 값 기준 정렬(`sort_values`), 인덱스 기준 정렬(`sort_index`) |
| `.sort_values('열')` | 열 값을 기준으로 정렬. `ascending=False`면 내림차순 |
| `.sort_index()` | 인덱스(행 라벨) 기준 정렬 |
| 날짜 인덱스 슬라이싱 | `df.loc['2024-06']` 처럼 기간으로 잘라 조회 (datetime 인덱스일 때만 가능, 문자열 상태로는 안 됨) |

### 사용 예 (날짜 인덱스로 기간 슬라이싱)
```python
ord_idx = (
    orders_df.dropna(subset=['order_datetime'])  # 결측치 제거
    .set_index('order_datetime')                 # 컬럼을 인덱스로 이동
    .sort_index()                                 # 인덱스 정렬
)
june_cnt = ord_idx.loc['2024-06'].shape[0]        # 2024년 6월 건수 (datetime일 때만 가능!)
```
- 메서드 체이닝(`.dropna().set_index().sort_index()`)을 괄호로 감싸서 한 번에 처리하는 스타일을 선호함.

---

## 4. 데이터 선택 (필터링)

| 메서드 | 내용 | 사용법 | 방식 | 추출 시 |
|---|---|---|---|---|
| `&` \| `~` | 비교. `~`(부정) = "조건을 만족하지 않는 행" | `df["channel"] == "web"` → **True만 나옴!** / `((orders_df['channel']=='app') & (orders_df['status']=='canceled')).shape[0]` → **True/False 전체 개수**이니 주의! | 불리언 필터: 조건이 곧 **True/False 시리즈** | 행 추출. ⭐️ `.sum()` : True 결과 개수 |
| `.isin([..])` | in(포함) 추출 | `(orders_df['channel'].isin(['web','app'])).sum()` | | |
| `.between(a, b)` | 특정 범위 추출 | 값이 a 이상 b 이하(양끝 포함)인지 | | |
| `.str.contains("문자")` | 문자타입으로 바꿔 포함 여부 확인 | **결측이 있으면 `na=False`를 줌.** `products_df['product_name'].str.contains('노트북').sum()` | | |
| `.notna()` / `.isna()` | 결측이 아닌지 / 결측인지 | `orders_df['order_datetime'].isna()` → "Null이니?" (`False`는 Null이 아니라는 뜻) | | |
| `.nlargest()` | 상위 추출 | (표에는 `.nlarges()`로 오타 있음 — ⚠️ 확인 필요: 실제 메서드명은 `nlargest`) | | |
| `.nsmallest()` | 하위 추출 | | | |
| `.duplicated()` | ⚠️ 표에는 "중복값 제거"라고 적혀 있으나, 실제로는 **중복 여부(True/False)를 찾을 뿐 제거하지 않음** — 제거는 `drop_duplicates()`. 뒤 "데이터 정제" 섹션에서는 본인이 이 차이를 정확히 구분해서 다시 적어둠. **확인 필요(표의 설명이 틀림, 뒤쪽 설명이 맞음)** | | | |
| `.sort_values()` | 정렬 | | | |
| `.dropna(subset=[])` | NULL인 행 삭제 | | | |
| `.query('조건')[출력]` | 조건 (SQL의 WHERE) | | | |

### 조건 조합 패턴 (반복적으로 쓰는 스타일)
```python
con1 = orders_df['channel'] == 'web'
con2 = orders_df['status'] == 'delivered'
con3 = orders_df['order_datetime'].dt.month == 6

seq3 = orders_df[con1 & con2 & con3]
seq3.shape[0]   # 행수 = 건수
```
- 조건을 `con1`, `con2`, `con3`... 변수에 먼저 담아두고 `&`로 조합하는 패턴을 자주 사용.
- `.query('channel == "web" and status == "delivered"')` 로 SQL-스타일 조건 문자열을 쓰는 것도 병행.

### `.between()`
```python
sel = customers_df.loc[
    customers_df['customer_id'].between(5000, 5010),
    ['customer_id','name','city']
]
sel.sort_values('customer_id', ascending=True)

(order_items_df['quantity'].between(1, 3)).sum()
```

### `.isin()` / `~.isin()`
```python
customers_df.loc[customers_df['city'].isin(['서울','부산']), ['name','city']]
customers_df.loc[~customers_df['city'].isin(['서울','부산']), ['name','city']]
# .loc 안 쓰고도 검색 가능:
customers_df[~customers_df['city'].isin(['서울','부산'])][['name','city']]
```

### `.nlargest()` / `.nsmallest()` / `.sort_values()`
```python
products_df.nlargest(5, 'cost')
products_df.nsmallest(5, 'cost')

top5 = products_df.sort_values('cost', ascending=False).head(5)

# 다중 컬럼 정렬 (1차/2차 각각 오름/내림 지정)
multi_df = products_df.sort_values(
    ['category','cost'],
    ascending=[True, False]   # 1차: category 오름차순, 2차: cost 내림차순
)
```

### `.query()`
```python
customers_df.query('gender == "여" and city == "서울"')[['name','gender','city']]
```

---

## 5. 데이터 정제

> 결측·중복·이상값·타입. **결측이 어디에 얼마나 있는지 파악하고, 각 열의 의미에 맞게 처리**하는 것.
> ⭐️ 내가 고른 **전략과 근거가 있어야 함** (예: 단가를 0으로 채우면 매출이 0으로 왜곡되므로 안 됨).
> **세 가지 경우 모두 같은 3단계**: **진단**(무엇이 얼마나 잘못됐나) → **규칙 결정**(무엇을 어떻게 고칠까) → **전후 대조**(정말 고쳐졌나). — 이 3단계는 매번 의식적으로 따르는 개인 워크플로우.

| 개념 | 내용 |
|---|---|
| `NaN` (Not a Number) | Null = 없다. float 자료형이며 비어있을 때 표시. **결측이 하나라도 섞인 정수 열은 float로 바뀜**. ⚠️ 확인 필요: pandas의 nullable `Int64`(대문자) dtype을 쓰면 정수형을 유지하면서 결측(`pd.NA`)을 가질 수 있음 — 노트에는 이 대안이 언급되어 있지 않음. |
| `NaT` (Not a Time) | 날짜/시간 열의 결측 표시 |
| 중복값(duplicate) 처리법 | `duplicated()`로 중복 여부(불리언)를 찾고, `drop_duplicates(subset=..., keep=...)`로 제거. `subset`으로 무엇을 "같은 행"으로 볼지(전체 열 vs 키 열), `keep`으로 어느 것을 남길지(`'first'`·`'last'`·`False`) 결정 |
| 이상값(outlier) 처리법 | 정상 범위를 크게 벗어난 값. `describe()`와 분위수(25%, 75%)로 범위 파악 → 불가능한 값을 조건으로 걸러내거나 `clip(lower=, upper=)`으로 상·하한을 씌움 |
| 타입 오염 처리법 | 숫자여야 할 값이 `'12300원'`·`'14,200'`처럼 문자열로 들어와 열 전체가 str이 된 경우 → `to_numeric(errors='coerce')` · `astype`으로 숫자로 되돌리고, 변환 실패는 결측으로 만들어 다시 처리 |
| `isna()` / `notna()` | 결측이면 True / 결측이 아니면 True로 위치 찾음 |
| 그대로 두기 (처리 안 함) | 결측 자체가 의미일 때. 예: `gender` 무응답 — 함부로 채우면 성별 분포 왜곡 |

| 메소드 | 사용법 |
|---|---|
| `isna().sum()` | 열별 결측(null) 수 |
| `isna().mean()` | 결측 비율 |
| `dropna(subset=[''])` | 결측이 하나라도 있는 행을 통째로 버림(행 삭제) |
| `fillna` | 채우기 (채울 근거가 분명할 때만) |
| `duplicated` | 중복을 "확인"(불리언 반환) |
| `drop_duplicates(subset=..., keep=...)` | 중복된 것 실제로 삭제 |
| `describe` | 상식적으로 이상한 값 찾기 |
| `astype` | 문자 → 숫자(dtype ⇒ numpy)로 형변환 |
| `map` | 값 치환(딕셔너리 매핑) |

### 진단 → 규칙 → 대조 3단계 예시 (표준 템플릿)
```python
import pandas as pd
oi = pd.read_csv("data/order_items.csv")

# 1) 진단: 중복·이상값
before_rows = len(oi)
dup_cnt = oi.duplicated().sum()
neg_qty = (oi["quantity"] <= 0).sum()
print("정제 전 행수:", before_rows)
print("완전 중복 행수:", dup_cnt)
print("수량 0 이하(이상값) 개수:", neg_qty)
print("quantity 최솟값/최댓값:", oi["quantity"].min(), "/", oi["quantity"].max())

# 2) 규칙 적용: 중복 제거 후 수량 1 이상만 남긴다
oi_clean = oi.drop_duplicates()
oi_clean = oi_clean[oi_clean["quantity"] > 0]
print("정제 후 행수:", len(oi_clean))  # len으로 지워진 후 남은 데이터 확인
```

### 결측치 처리 종합 예 (전략을 컬럼마다 다르게)
```python
cleaned = cust_df.copy()   # 원본 보호 습관 — 항상 복사본에서 작업

# 1. gender: 범주형 결측은 "미상" 같은 라벨로 채움
cleaned['gender'] = cleaned['gender'].fillna('미상')

# 2. birth_date: 값이 없으면 그 행을 아예 버림 (dropna는 새 DF를 반환 — 반드시 재대입)
age_ready = cust_df.dropna(subset=['birth_date'])

# 3. email: 분석에 안 쓰므로 그대로 둔다 (결측 처리 안 함도 하나의 전략)
```
- 숫자 컬럼 결측은 평균/중앙값으로 채우는 방법도 있음: `order_items_df['unit_price'].fillna(order_items_df['unit_price'].mean())`
- **개인 규칙(캐치)**: "이상치(outlier)가 없는 경우에만 평균으로 채워도 된다" — 평균 대입은 이상치 유무를 먼저 확인한 뒤에.

### 타입 오염 정제 ('원', ',' 제거 → 숫자화)
```python
# errors 파라미터: raise(기본, 실패시 예외로 프로그램 중단) / coerce(변환 실패→NaN, 안전) / ignore(원본 그대로, "쓸모없음"이라고 스스로 적어둠)
# ⚠️ 확인 필요: pandas 3.0.3 기준 `errors='ignore'` 옵션은 완전히 제거되어 예외(ValueError: invalid error value specified)가 발생함.
#   → 노트에 적힌 "ignore : 원본 그대로 반환 (쓸모없음)"이라는 판단 자체는 결과적으로 맞았지만,
#      최신 pandas에서는 아예 쓸 수 없는 값이 되었으니 실습 코드에서 제거해야 함.

fail_cnt = pd.to_numeric(prod['price'], errors="coerce").isna().sum()  # 변환 실패 개수 진단

price_str = (prod['price'].astype(str)
             .str.replace('원', '', regex=False)   # regex=False: 정규식 아님을 명시 (개인 규칙)
             .str.replace(',', '', regex=False))
prod['price'] = pd.to_numeric(price_str, errors="coerce")
prod['price'].isna().sum()          # 변환 후 NaN 재확인
(prod['price'] < 0).sum()           # 음수 가격(이상값) 개수
prod.loc[prod['price'] < 0]         # 음수 가격 행 직접 확인
```
- **개인 규칙**: `str.replace()`로 리터럴 문자를 지울 때는 항상 `regex=False`를 명시한다 (정규식으로 잘못 해석되는 것 방지).

### 공백 정제
```python
prod['category'] = prod['category'].str.strip()
cust['city'] = cust['city'].str.strip()
```
- **개인 규칙**: `.str.strip()` 등 str 메서드는 원본을 바꾸지 않으므로 **반드시 같은 컬럼에 재대입**해야 반영된다는 점을 계속 스스로 반복해서 메모함 — 이 실수를 여러 번 했던 것으로 보임.

### 값 재매핑 (성별 F/M/남/여 혼재 등)
```python
cust['gender'].value_counts(dropna=False)   # dropna=False: NaN도 개수에 포함해서 보기

gmap = {'남':'M', '여':'F', 'F':'F', 'M':'M'}  # 원래 F, M도 항등 매핑을 넣어줘야 함 — 세팅 시 주의
cust['gender'] = cust['gender'].map(gmap)
```

### 문자열 분리 (등급 + 상품명 → 두 컬럼)
```python
prod['product_name'] = prod['product_name'].str.strip()   # split 전에 항상 먼저 공백 제거
parts = prod['product_name'].str.split(' ', n=1, expand=True)  # n=1: 1번만 분리, expand=True: DataFrame으로
prod['grade'] = parts[0]
prod['item'] = parts[1]
```

### `cust.info(0)` — ⚠️ 확인 필요
- 노트에 `cust.info(0)`처럼 위치 인자로 `0`을 넘긴 코드가 있음. `DataFrame.info()`의 시그니처상 의미 있는 동작이 아닐 가능성이 높음(오타로 추정) — 실제로 뭘 의도했는지 다시 확인할 것.

---

## 6. str 메서드

> str 메서드는 원본을 바꾸지 않고 새 시리즈를 반환하므로, **결과를 다시 열에 할당해야 반영**됨. 또 결측(NaN)이 섞인 열에 str 메서드를 쓰면 NaN은 그대로 남음.

| 메소드 | 사용법 |
|---|---|
| `str.strip` | 앞뒤 공백 제거. 원본에 반영 안 되므로 대입해야 함 → `cust['city'] = cust['city'].str.strip()` |
| `str.lower` / `str.upper()` | 대소문자 통일 |
| `str.split(구분자)` / `str.extract(정규식)` | 문자열 분리 / 일부 추출 |
| `str.replace(a, b)` | 대체 |
| `str.contains(패턴)` | 포함 여부를 불리언으로 반환(필터에 사용) |

```python
products_df['product_name'].str.contains('홍차')          # 문자열 포함 여부 → True/False
products_df['product_name'].str.contains('노트북').sum()   # True 개수
```

---

## 7. 파생 변수와 데이터 변환

> 벡터화 연산(np. 브로드캐스팅) 지원: 열 전체를 한 번에 계산 → 원소별 연산.
> `ndarray`: 다차원 배열, 동일 타입만 저장 → 속도 빠름(for문 사용 X).
> 구간화: 연속값을 여러 구간으로 나눠 범주로 만드는 것.

| 메서드 | 내용 |
|---|---|
| `assign` | 원본은 유지하고 복사해서 계산 (새 DataFrame 반환). "벡터연산"으로 기존 테이블에 컬럼을 바로 추가하는 다른 방법도 있음 |
| `apply` | 순차 처리(반복문 개념), 데이터프레임에 적용 가능한 메서드 |
| ⭐️ **벡터연산(numpy)** | 원소별 연산, 단순 연산 시 유리. 병렬처리, for문 사용 X, 속도 빠름, 메모리 절약 |
| `np.where(조건)` | 벡터연산. 이진 분류 |
| `np.select(조건들, 값들, 기본값)` | 벡터연산. 다중 분류 |
| `axis=0` / `axis=1` | DataFrame에서 Y축 합 / X축 합 |
| `.cut()` | (연속값 구간화) 구간 폭이 제각각. **기본이 오른쪽 포함(`right=True`)**. 첫 값까지 포함하려면 `include_lowest=True`를 줘야 함. 예: 연령대 |
| `.qcut()` | (연속값 구간화) 개수는 같지만 값 폭이 다른 구간이 됨(예: 하·중·상 등급화) |

### 개인 규칙
- **np.where가 조건이 많아 복잡해지면 코드가 지저분해진다** → 그럴 땐 `apply(function, axis=1)`로 사용자 정의 함수를 넘기는 방식도 씀. 다만 apply는 순차처리라 느림 — 성능이 중요하면 `np.select`/`np.where` 조합을 우선 고려.
- 단순 합계 같은 것은 `apply(sum, axis=1)`, `sum(axis=1)`, 벡터 덧셈(`students['kor']+students['eng']`) 세 가지 방법을 비교해보고, **벡터 연산(원소별 덧셈)이 가장 빠르다**는 결론을 스스로 검증해서 적어둠.

### `assign` / 벡터 연산
```python
oi['amount'] = oi['unit_price'] * oi['quantity'] * (1 - oi['discount'])

prod2 = prod.assign(
    margin = prod['price'] - prod['cost'],
    margin_rate = (prod['price'] - prod['cost']) / prod['price']
)
```

### `np.where` / `np.select`
```python
oi['grade'] = np.where(oi['amount'] > 100000, '고액', '일반')

conditionlist = [oi['amount'] >= 200000, oi['amount'] >= 50000]
choiselist = ['최고액', '고액']
oi['tier'] = np.select(conditionlist, choiselist, default='일반')
```

### `apply` (복합 조건 라벨링)
```python
def label(row):
    if row['amount'] >= 100000 and row['discount'] >= 0.3:
        return '고액-대폭할인'
    return '기타'

oi.apply(label, axis=1)

# 위와 동일한 걸 np.where로 (더 빠름):
cond1 = oi['amount'] >= 100000
cond2 = oi['discount'] >= 0.3
np.where(cond1 & cond2, '고액-대폭할인', '기타')
```

### `.cut()` (구간화 — 나이대)
```python
cust['birth_date'] = pd.to_datetime(cust['birth_date'])
cust['age'] = 2026 - cust['birth_date'].dt.year   # 기준 연도 - 생년

bins = [0, 19, 29, 39, 49, 59, 200]
labels = ['10대이하','20대','30대','40대','50대','60대 이상']
cust['age_group'] = pd.cut(cust['age'], bins=bins, labels=labels)
cust['age_group'].value_counts().sort_index()
```

### `.qcut()` (구간화 — 가격 4등급 균등분할)
```python
prod['price_tier'] = pd.qcut(
    prod['price'],
    q=4,
    labels=['저가','중가','고가','최고가']
)
```

### 값 재매핑 (읽기 쉬운 라벨)
```python
smap = {
    'paid':'결제완료', 'delivered':'배송완료', 'shipped':'배송중',
    'canceled':'취소', 'returned':'반품',
}
orders['status_ko'] = orders['status'].map(smap)
```

---

## 8. 재구조화 (reshape)

> 표의 형식을 바꾸는 것. 두 방향(melt / pivot).

| 도구 | 내용 |
|---|---|
| `.concat()` | 같은 구조의 데이터를 (아래로) 이어서 붙임 (`merge`와 다름) |
| `axis=0` / `axis=1` | 아래로 붙임(세로형, union all — 위치가 아니라 **컬럼명 매핑**) / 옆으로 붙임(가로형) |
| `.melt()` | 넓은 형식 → **긴 형식(long format)**. "하나의 관측값" 형태(예: 카테고리, 월, 매출) |
| `.pivot()` | 긴 형식 → **넓은 형식(wide format)**. 집계·시각화·리포트에 맞게 펼침 |
| `.stack()` / `.unstack()` | 열과 인덱스 사이를 오가는 같은 계열 도구 |

```python
pd.concat([df1, df2], ignore_index=True)   # 인덱스 무시하고 새로 생성
pd.concat([df1, df2], axis=0)              # union all (컬럼명 기준 매핑, 세로형)
pd.concat([df1, df2], axis=1)              # 인덱스 유지, 가로형

wide = df.pivot(index='date', columns='city', values='temp')

# values가 여러 개면 멀티 컬럼 결과가 됨
result = df.pivot(columns='city', index='date', values=['temp','humid'])
result['humid']            # 서브셋 선택
result[('temp','busan')]   # 튜플 키로 특정 셀 그룹 선택

df.melt(id_vars='name', value_vars=['kor','eng'])
df.melt(
    id_vars=['name','grade'],
    value_vars=['kor','eng'],
    var_name='subject',   # value_vars 컬럼명이 모일 새 컬럼명
    value_name='score'    # 값이 모일 새 컬럼명
)
```
- 개인 메모: "pivot과 melt는 서로 반대되는 개념. pivot은 wide로, melt는 long으로 바꾼다."

---

## 9. 피벗테이블

| 도구 | 내용 |
|---|---|
| `pivot_table()` | 두 축(카테고리×채널) 매출 요약표 |
| `margins=True` | ALL(합계) 행/열 표시 추가 |
| `margins_name="네임"` | ALL 이름 지정 |
| `fill_value=0` | NaN(null)인 값을 0으로 대체 |
| `.reset_index()` | 다중 인덱스를 삭제해서 인덱스 레벨을 다시 일반 컬럼으로 끌어올림 |

### ⚠️ 확인 필요
- 원본 표에 `on = left_on/right_on`, `how = inner/left/outer` 항목이 `pivot_table()` 표 안에 함께 적혀 있는데, **이 두 파라미터는 `pivot_table()`이 아니라 `merge()`의 파라미터**임. 아마 merge 섹션을 정리하다가 같은 표에 섞여 들어간 것으로 보임 — 다음에 정리할 때 이 두 줄은 merge 섹션으로 옮길 것.

```python
pd.set_option('display.float_format', '{:,.0f}'.format)   # 숫자를 지수표기 대신 콤마 정수로 표시 (개인 디스플레이 습관)

pt = pd.pivot_table(
    data=m,
    index='category',
    columns='channel',
    values='amount',
    aggfunc='sum',
    margins=True,
    margins_name="합",
    fill_value=0
)

multi = pd.pivot_table(
    data=m,
    index='category',
    values='amount',
    aggfunc=['sum','mean','count']   # 한 표에 여러 집계 함수
)
```

---

## 10. 그룹화와 집계 (aggregation)

> 그룹화 핵심 원리: **'쪼개서 - 계산해 - 합치기'**. 집계: 두 축을 한 표로 요약하는 피벗테이블·교차표(crosstab).

| 메서드 | 내용 |
|---|---|
| `.merge()` | 합치기(join), 옆으로 이어붙임 |
| `.groupby()` | 열의 값 기준으로 데이터를 그룹으로 정리. 카테고리별·채널별 매출 합계와 건수를 집계하고 정렬해 상위 그룹을 뽑음 |
| `.agg()` | 집계 (새 DataFrame 생성). 이름 붙은 집계로 한 그룹에 여러 지표 계산 |
| `.transform()` | 그룹 통계(agg 집계값)를 원래 행에 되돌릴 수 있음 (SQL의 OVER 절과 비슷) |
| `.size()` | 각 조합의 행수를 셈(다중 키 그룹화 시). **count와 달리 결측을 포함한 순수 행 개수** |
| `.crosstab()` | 빈도·비율표를 만들고 집계 총합을 원본과 대조해 검증 |

### 순차 병합 + 정제 패턴 (여러 테이블을 하나로)
```python
# 1. 정제 먼저
products['price'] = pd.to_numeric(products['price'], errors='coerce')
products['category'] = products['category'].str.strip()
prod = products.drop_duplicates(subset=['product_id'])
cust = customers.drop_duplicates(subset=['customer_id'])
items['unit_price'] = pd.to_numeric(items['unit_price'], errors='coerce')

# 2. 필요한 컬럼만 골라서 병합
items = items.merge(prod[['product_id','category']], on='product_id', how='inner')

# 3. 결측 채우기 (여기 unit_price를 price로 보완)
items['unit_price'] = items['unit_price'].fillna(items['price'])
items = items.drop(columns=['price'])

# 4. 순차 병합(메서드 체이닝) — 여러 테이블을 한 번에 합치는 습관적 패턴
full = (
    items
    .merge(orders, on='order_id', how='left', validate='m:1')
    .merge(cust, on='customer_id', how='left', validate='m:1')
    .merge(prod, on='product_id', how='left', validate='m:1')
)

full['amount'] = full['unit_price'] * full['quantity'] * (1 - full['discount'])

f = full.dropna(subset=["order_datetime"])   # 키가 되는 날짜 컬럼 결측 제거
f["month"] = f["order_datetime"].dt.month     # 월 컬럼 파생
```
- **개인 규칙**: `merge()`에 `validate='m:1'` 같은 파라미터를 붙여 병합 관계(1:1, m:1 등)를 명시적으로 검증하는 습관.
- 메서드 체이닝(`.merge().merge().merge()`)을 괄호로 감싸서 여러 병합을 한 블록으로 이어 쓰는 스타일을 그룹화/병합 파트에서도 반복 사용.

---

## 11. 시계열 데이터 — `.resample()`

> **시계열 데이터를 날짜/시간 인덱스 기준으로 재구성(그룹화)하는 것.**

| 메서드 | 내용 |
|---|---|
| `.resample()` | 시계열을 날짜/시간 인덱스 기준으로 재구성. `groupby(ts.index.date)`와 비슷. 예: `.resample("ME")`로 월별 묶어서 합계 |
| `rolling` | 이동평균 |
| `.shift(1)` | 한 칸씩 내리기 |
| `.shift(fill_value=0)` | 밀려서 생긴 NaN을 0으로 바꾸기 |
| `.expanding().sum()` | 누적합 |
| `.expanding().std()` | 누적 표준편차 |
| `.expanding().quantile(0.9)` | 누적 분위수(90%) |

### 빈도 문자열(Rule) 표

**기본 단위**
- `ns`/`us`/`ms` : 나노/마이크로/밀리초
- `s` : 초
- `min` : 분
- `h` : 시간
- `D` : 일
- `B` : 영업일(주중), 월~금
- `C` : 커스텀 영업일
- `W` : 주

**월/분기/연 (시작/끝 구분)**
- `MS` : 월 시작 / `ME` : 월 말
- `BMS`/`BME` : 영업일 기준
- `QS`/`QE` : 분기 시작/말
- `BQS`/`BQE` : 영업일 기준 분기 시작/말
- `YS`/`YE` : 연 기준
- `BYS`/`BYE` : 영업일 기준 연 시작/말 — ⚠️ 확인 필요: 원본 노트에는 이 줄이 `BYE/BYE`로 오타로 적혀 있었음. 실제로는 `BYS`(연초, business year start)와 `BYE`(연말, business year end)가 맞고 pandas 3.0.3에서 둘 다 유효한 별칭으로 확인됨.
- `SMS`/`SME` : 반월(15일 기준). `SMS`→1일~15일, `SME`→15일 00:00~말일 (거의 안 씀)

**사용 예 (배수/앵커)**
```python
df.resample('15min')   # 15분
df.resample('3D')      # 3일
df.resample('2W')      # 2주
df.resample('90s')     # 90초

df.resample('W-MON')   # 월요일에 끝나는 주
df.resample('QE-JAN')  # 1월에 끝나는 회계 분기
```
- 참고: 노트에 쓰인 `ME`/`YE` 계열 별칭은 pandas 2.2+에서 `M`/`A` 등 구(舊) 별칭을 대체한 최신 표기이며, 현재(3.0.3)까지 유효함 — 이 부분은 이미 최신 관례를 따르고 있음.

### 사용 예
```python
daily = ts["amount"].resample("D").sum()
roll7 = daily.rolling(window=7).mean()          # 7일 이동평균

m = monthly[['매출']]
m['전월매출'] = m.shift(1)
m['증감액'] = m['매출'] - m['전월매출']

m_data['누적매출'] = m_data['매출'].expanding().sum()
m_data['매출'].expanding().std()
m_data['매출'].expanding().quantile(0.9)
```

---

## 12. 대용량 데이터와 성능 (심화)

> ① 다시 재보기(측정) → ② 메모리 나눠 읽기(청크) → 마지막에 합침 → ③ 저장하기(Parquet)

### `.copy()`와 가비지 컬렉션 — 선생님 확인(2026-07-30)
- `.copy()`를 "쓰지 말라"는 게 아니라 **프로젝트·상황에 따라 판단**해서 쓰는 것 — 필터링/슬라이싱한 결과에 새 컬럼을 추가하거나 값을 바꿀 거면 써야 하고(안 그러면 `SettingWithCopyWarning`), 그냥 읽기만 할 거면 안 써도 됨.
- **가비지 컬렉션은 항상 실시간으로 도는 게 아니다.** 파이썬은 레퍼런스 카운팅(참조가 0이 되면 즉시 해제)과, 순환 참조를 처리하는 세대별(generational) GC 두 가지를 같이 쓰는데, 후자는 주기적으로만 돈다. pandas DataFrame처럼 내부 구조가 복잡한 객체는 순환 참조에 걸릴 수 있어 "언젠가 지워지겠지"라고 믿으면 실제로는 한동안 메모리에 남아있을 수 있다. 파이썬이 객체를 내부적으로 해제해도 그 메모리를 OS에 바로 반납 안 하는 경우도 많음.
- **결론(선생님 지침)**: GC 타이밍을 믿고 낭비성 코드를 짜지 말고, 처음부터 불필요한 메모리 낭비가 안 생기도록 코딩한다 — 예를 들어 필터링으로 행이 크게 줄어드는 상황이면, 전체에 컬럼을 먼저 계산하기보다 **필터링해서 작아진 부분에만** `.copy()`하고 계산하는 쪽이 대용량에서 유리하다.

### 데이터 형태 구분 (분석 설계용 개념 메모)
- **범주형** (문자열, 숫자): 명목형(순서 없음, 예: 도시/성별/학과/요일/혈액형), 순서형(순서 있음, 평균 내서 의미 있음, 예: 학점/만족도)
- **연속형** (정수, 실수): 예 키/몸무게/매출액/점수
- **구분법**: 값 두 개를 골라 평균을 낸다 → 말이 되면 연속형, 말이 안 되면 범주형 (개인 판별 기준으로 적어둔 방법)

### 파일 포맷
- 텍스트 파일: 문서 저장 파일 (CSV)
- 바이너리 파일: 2진수 저장 파일 (Parquet — 열 단위 압축 저장 형식) → 공간도 줄이고 속도도 빠름(인코딩-디코딩 부담 없음)

### 측정 / 카테고리 dtype으로 메모리 절약
```python
logs = pd.read_csv('../data/web_logs.csv')

print(f'shape : {logs.shape}')
print(f'dtypes : \n{logs.dtypes}')
print(f'메모리 사용 : {logs.memory_usage(deep=True)}')   # deep=True: 상세하게

log2 = logs.copy()
log2['event_type'] = log2['event_type'].astype('category')   # 범주형 변환만으로 메모리 절약

before = logs.memory_usage(deep=True)['event_type']
after = log2.memory_usage(deep=True)['event_type']
```

### 청크로 나눠 읽기
```python
total = pd.Series(dtype='int64')   # 빈 시리즈(1차원 저장소) 준비

n_chunks = 0
for chunk in pd.read_csv('../data/web_logs.csv',
                          usecols=['event_type'],   # 필요한 컬럼만
                          chunksize=200000):        # 20만건씩 나눠서
    total = total.add(chunk['event_type'].value_counts(), fill_value=0)
    n_chunks += 1
```
- 개인 메모: "100만 건 정도로는 청크할 필요 없다! 억 단위처럼 완전 큰 데이터에나 쓰는 것."

### Parquet 저장/비교
```python
logs['event_type'] = logs['event_type'].astype('category')
logs.to_parquet('../data/web_logs.parquet', engine='pyarrow')

import time
t0 = time.perf_counter(); _ = pd.read_csv('../data/web_logs.csv'); t_csv = time.perf_counter() - t0
t0 = time.perf_counter(); _ = pd.read_parquet('../data/web_logs.parquet', engine='pyarrow'); t_pq = time.perf_counter() - t0
```
- CSV와 Parquet의 읽기 속도를 `time.perf_counter()`로 직접 비교해보는 습관.

---

## 13. 응용 예제 모음 (실무 사용법 연습)

> 노트의 "💡 응용하기" 섹션. 위 개념들을 실제 컬럼/조건으로 연습한 기록. 개인 습관이 가장 잘 드러나는 부분이라 그대로 보존.

### 숫자 표시 옵션
```python
pd.set_option('display.float_format', '{:,.0f}'.format)   # 지수표기 대신 정수/콤마로
```

### True/False 개수 뽑아내기 3가지 방법
```python
expencive = products_df.loc[
    products_df['cost'] > 100000,
    ['product_name','category','cost']
]
expencive['product_name'].count()   # 방법 1
expencive.shape[0]                  # 방법 2 — (행, 열) 튜플에서 행 개수만
condition.sum()                     # 방법 3 — True 개수 직접 합산
```
- 세 방법의 차이를 명확히 구분해서 적어둠: `.count()`는 결측 제외 개수, `.shape[0]`은 필터링된 결과의 행 개수, `.sum()`은 불리언 시리즈 자체에서 True 개수.

### loc / iloc 실무 연습 단계
```python
customers_df[['name','city']].head()          # 열만 (행 조건 없이)
customers_df.iloc[0, 1]                        # 행,열 위치 접근
customers_df.iloc[0:3, [1,5]]                  # 숫자 인덱스로 다중 열
customers_df.iloc[0:3, [1,-2]]                 # 음수 인덱스로 뒤에서 접근
customers_df.loc[0:2, ['name','city']]         # 라벨 기반
```

### 특정 도시 고객 수
```python
busan_customers = customers_df.loc[customers_df['city']=='부산', ['name','city']]
busan_customers.shape[0]
```

### 조건 포함/미포함 + 개수
```python
condition = orders_df['channel'] == 'web'
orders_df[condition][['order_id','channel']]
orders_df[condition].shape[0]      # 또는 condition.sum()

orders_df[~(orders_df['channel'] == 'web')].shape[0]   # web이 아닌 것
```

### 2개 이상 조건 조합 3가지 스타일
```python
con1 = orders_df['channel'] == 'web'
con2 = orders_df['status'] == 'delivered'
orders_df[con1 & con2].shape[0]                                  # 방식 A: 불리언 인덱싱

seqq = orders_df.query('channel == "web" and status == "delivered"')
seqq.shape[0]                                                     # 방식 B: query 문자열
```

### 월 조건 추출
```python
# 문자열일 때 (비추천 스타일 — datetime 파싱 전 임시 확인용)
orders_df['order_datetime'][0].split('-')[1] == '06'

# datetime으로 파싱한 뒤 dt 접근자 사용 (선호하는 방식)
orders_df = pd.read_csv('../data/orders.csv', parse_dates=['order_datetime'])
orders_df['order_datetime'].dt.month == 6
```

### 월별 건수 집계 — ⚠️ 확인 필요 (비효율적 패턴)
```python
o["month"] = o["order_datetime"].dt.month
jan = o[o["month"] == 1]
feb = o[o["month"] == 2]
# ... 3월~12월까지 각각 변수를 따로 만듦
print(f'1월 개수: {jan.shape[0]}')
# ... 등등
j_f = pd.concat([jan, feb], axis=0)
```
- 12개월을 각각 별도 변수(`jan`, `feb`, ... `dec`)로 나눠 만들고 개별 `print`로 개수를 확인한 뒤 `concat`으로 다시 합치는 방식.
- **확인 필요/개선 여지**: 이 패턴은 동작은 하지만 반복이 매우 많고, 같은 결과를 `groupby(o["month"]).size()` 한 줄로 훨씬 간결하게 얻을 수 있음. 그룹화 섹션에서 이미 `.groupby()`, `.size()`를 알고 있으므로, 다음에 비슷한 걸 짤 때는 groupby 방식으로 대체를 검토할 것.

### 결측치 처리 (컬럼 성격별 전략)
```python
cleaned = cust_df.copy()
cleaned['gender'] = cleaned['gender'].fillna('미상')            # 범주형: 라벨로 채움
age_ready = cust_df.dropna(subset=['birth_date'])                # 핵심 계산에 필요한 값: 행 삭제
# email: 그대로 둠 (분석에 안 씀)

order_items_df['unit_price'] = order_items_df['unit_price'].fillna(
    order_items_df['unit_price'].mean()
)   # 이상치 없는 숫자 컬럼: 평균으로 채움 (이상치 있으면 이 방법 쓰지 말 것)
```

### 데이터 정제: 타입 오염 + 음수 값 진단
```python
fail_cnt = pd.to_numeric(prod['price'], errors="coerce").isna().sum()
prod.loc[pd.to_numeric(prod['price'], errors="coerce").isna(), 'price'].head(10)  # 뭐가 문제인지 원본값 확인

price_str = (prod['price'].astype(str)
             .str.replace('원', '', regex=False)
             .str.replace(',', '', regex=False))
prod['price'] = pd.to_numeric(price_str, errors="coerce")

(prod['price'] < 0).sum()          # 음수 가격 개수
prod.loc[prod['price'] < 0]        # 행 직접 확인
```

### '프리미엄' 등급 상품 수 + 상품명 분리
```python
prod['product_name'].str.contains('프리미엄').sum()

prod['product_name'] = prod['product_name'].str.strip()
parts = prod['product_name'].str.split(' ', n=1, expand=True)
prod['grade'] = parts[0]
prod['item'] = parts[1]
prod['grade'].value_counts()
```

---

## 14. 개인 컨벤션 / 항상 지키는 규칙 정리

노트 전체에서 반복적으로 나타나는, "이 사람 고유의 코딩 습관"에 해당하는 부분들을 모았습니다. pandas-expert가 힌트를 줄 때 이 습관들과 어긋나지 않게 맞춰줘야 하는 부분입니다.

1. **3단계 데이터 정제 워크플로우**: 항상 **진단(무엇이 문제인가) → 규칙 결정(어떻게 고칠까) → 전후 대조(정말 고쳐졌나)** 순서로 접근. 결측/중복/이상값/타입오염 어디에나 이 틀을 적용.
2. **처리 근거를 남긴다**: "왜 이렇게 채웠는지/버렸는지" 근거를 주석이나 print로 남기는 습관 (예: "단가를 0으로 채우면 매출이 왜곡되므로 안 됨").
3. **원본 보호**: 수정 전 `.copy()`로 복사본을 만들고 그 위에서 작업. `dropna()`, `drop_duplicates()`, `str.strip()` 등은 원본을 바꾸지 않고 새 객체를 반환한다는 것을 계속 스스로 상기시키며, 반드시 변수에 재대입.
4. **진단 print는 번호를 붙인다**: `print(f'01) ... : {값}')`, `print(f'02) ... : {값}')` 처럼 단계별로 번호를 매겨 순차적으로 출력하는 스타일을 자주 사용 — 나중에 로그를 순서대로 검토하기 쉽게 하려는 개인 습관으로 보임.
5. **정규식 아닌 리터럴 치환은 `regex=False` 명시**: `str.replace('원', '', regex=False)` 처럼 항상 명시.
6. **`to_numeric`/`astype` 변환 시 `errors='coerce'` 우선**: 실패를 예외로 죽이지 않고 NaN으로 만들어 계속 진행 가능하게. `errors='ignore'`는 이미 "쓸모없다"고 스스로 판단(⚠️ 실제로 pandas 3.0.3에서는 아예 지원 안 함 — 아래 확인 필요 목록 참고).
7. **날짜는 `parse_dates=[...]`로 읽을 때 바로 파싱**: 나중에 `pd.to_datetime()`으로 별도 변환하기보다, `read_csv(..., parse_dates=[...])`을 우선 사용.
8. **조건은 변수로 먼저 쪼갠다**: `con1`, `con2`, `con3`처럼 조건을 변수에 담아둔 뒤 `&`/`|`로 조합 — 조건이 길어질 때 가독성을 위해.
9. **`.query()`도 병행 사용**: 불리언 인덱싱과 `.query('sql 스타일 문자열')`을 상황에 따라 섞어 씀.
10. **메서드 체이닝을 괄호로 묶어서 사용**: `(df.dropna(...).set_index(...).sort_index())`, `(items.merge(...).merge(...).merge(...))` 처럼 여러 단계를 괄호로 감싸 한 블록으로 표현하는 스타일을 그룹화/인덱싱/병합 여러 곳에서 반복.
11. **벡터 연산 우선, `apply`/반복문은 최후 수단**: 성능 이유로 `np.where`/`np.select`/열끼리 직접 연산을 먼저 고려하고, 조건이 복잡해서 도저히 안 될 때만 `apply(func, axis=1)`.
12. **표시 형식**: `pd.set_option('display.float_format', '{:,.0f}'.format)`을 노트북 초반에 설정해 숫자를 지수 표기 대신 천 단위 콤마로 보는 것을 선호.
13. **CSV 경로 관례**: 노트북에서 `../data/파일명.csv` 형태의 상대경로를 일관되게 사용(데이터는 노트북 상위 폴더의 `data/`에 위치).
14. **변수명 관례**: 초반 노트에서는 `customers_df`, `orders_df`, `products_df`, `order_items_df` 처럼 **`_df` 접미사**를 붙였지만, 뒤로 갈수록 `cust`, `prod`, `oi`, `orders`, `items`처럼 **접미사 없는 축약형**으로 바뀜. 이 문서 기준으로는 두 스타일이 혼재되어 있으니, pandas-expert는 둘 다 "본인 스타일"로 인식해도 됨(단, 같은 노트북 안에서는 일관성을 유지하는 게 좋다고 조언할 수 있음).

---

## 15. ⚠️ 확인 필요 목록 (한곳에 모음)

pandas 최신 버전(이 프로젝트에 설치된 3.0.3 기준) 또는 개념적으로 다시 봐야 할 부분들만 모았습니다.

| # | 위치 | 내용 | 확인 필요 이유 |
|---|---|---|---|
| 1 | 데이터 선택 표 | `.nlarges()`로 표기됨 | 실제 메서드명은 `nlargest()` — 오타로 보임 |
| 2 | 데이터 선택 표 | `.duplicated()`를 "중복값 제거"로 설명 | `duplicated()`는 중복 **여부(불리언)**만 찾을 뿐 제거하지 않음. 제거는 `drop_duplicates()`. 노트의 "데이터 정제" 섹션에서는 본인이 이미 정확히 구분해서 다시 적어둠 — 앞쪽 표만 수정 필요 |
| 3 | 피벗테이블 표 | `on = left_on/right_on`, `how = inner/left/outer` 항목이 `pivot_table()` 표 안에 있음 | 이 파라미터들은 `merge()`의 파라미터이지 `pivot_table()`의 파라미터가 아님. 표 배치 오류로 추정 |
| 4 | 데이터 정제 / 응용 예제 | `pd.to_numeric(..., errors='ignore')`를 "쓸모없음"이라 적었지만 계속 개념 설명에 남아있음 | pandas 3.0.3에서 실제로 실행해보면 `errors='ignore'`는 완전히 제거되어 `ValueError: invalid error value specified` 발생. 스스로의 "쓸모없다"는 판단은 맞았으나, 이제는 아예 존재하지 않는 옵션이므로 실습 코드/예제에서 삭제 필요 |
| 5 | 시계열 빈도 표 | `YS/YE` 다음 줄이 `BYE/BYE`로 중복 표기 | 문맥상 `BYS`(연초, 영업일 기준)와 `BYE`(연말, 영업일 기준)를 의도한 것으로 보이며, 둘 다 pandas 3.0.3에서 유효한 별칭으로 확인됨(`BYE-DEC`, `BYS-JAN`) — 단순 오타로 추정 |
| 6 | 데이터 정제 | "결측이 하나라도 섞인 정수 열은 float로 바뀐다" | numpy 백엔드 dtype에서는 맞는 설명. 다만 pandas의 nullable `Int64`(대문자 I) dtype을 쓰면 정수형을 유지하면서 결측(`pd.NA`)을 표현할 수 있음 — 노트에는 이 대안이 언급되지 않아 참고용으로 확인 필요 |
| 7 | 응용 예제(공백 정제) | `cust.info(0)` | `DataFrame.info()`에 위치 인자로 `0`을 넘긴 형태. 의도한 동작인지 오타인지 불명확 — 실행해서 실제로 뭘 의도했는지 재확인 필요 |
| 8 | 응용 예제(월별 건수) | `jan`~`dec` 12개 변수를 따로 만들어 `concat` | 오류는 아니지만 `groupby(df['order_datetime'].dt.month).size()` 한 줄로 대체 가능한 반복 패턴. 개선 여지로 플래그 |

---

*(이 문서는 Notion 페이지 "📀 판다스"의 전체 내용을 기반으로 재구성되었습니다. 원본에 포함된 스크린샷 이미지는 텍스트 코드/설명으로 대체되어 있으므로, 이미지에만 있던 실행 결과 값(숫자 등)은 이 문서에 포함되지 않았습니다.)*
