# 🤖 머신러닝 레퍼런스 (개인 학습 노트 기반)

> 이 문서는 Notion에 정리해온 머신러닝 학습 노트(`🎪 머신러닝(Machine Learing)` 페이지)를 워크플로우 순서로 재구성한 개인 레퍼런스입니다.
> 목적: 이후 ml-expert 에이전트가 "일반적인 머신러닝 튜토리얼"이 아니라 **내가 실제 수업에서 배우고 정리한 방식/습관/용어**에 맞춰 힌트를 주도록 하는 기준 문서.
> 원본 노트의 예제·표현을 최대한 유지했고, 이 프로젝트에 설치된 버전(scikit-learn 1.9.0, xgboost 3.2.0, lightgbm 4.7.0, hyperopt 0.3.0, imbalanced-learn 0.14.2)과 어긋나거나 다시 봐야 할 부분은 **"⚠️ 확인 필요"**로 표시했습니다. 노트에 "잘 안씀"으로 적힌 기법 옆에는 실제로 최근 더 권장되는 대안을 **"💡 최신 기법"**으로 보완해뒀고, 원본 노트가 스스로 "잘 안씀"이라 표시해둔 부분은 지우지 않고 **"💭"**로 표시해 그대로 남겨뒀습니다.
> 노트 말미에 있던, 내용이 비어있는 토글 섹션들(`# 🎯 제목` × 4, 그리고 과제 안내문 하단)은 실제 학습 내용이 없어 이 문서에 옮기지 않았습니다.

---

## 0. 환경 설정

### 가상환경 (Anaconda)
- 머신러닝은 **아나콘다(conda)**, 딥러닝은 venv가 낫다는 게 개인 판단(노트에 명시).

```bash
## 가상환경 설치 ##
conda create -n 폴더명 python=3.11

## 가상환경 진입 ##
conda activate 폴더명

## 가상환경에서 파이썬 버전 확인 ##
python -V

## 설치되어 있는 가상환경 목록 ##
conda env list

## 가상환경 빠져나오기 ##
conda deactivate

## 가상환경 삭제 ##
conda env remove -n 폴더명

## 넘파이, 판다스 설치 ##
conda install numpy pandas

## 주피터 노트북 커널 설치 ##
conda install ipykernel
pip install ipykernel
python -m ipykernel install --user --name=폴더명

## 엑셀 파일 다룰 때 필요한 모듈 ##
conda install xlrd openpyxl -y
```

### 사이킷런 · XGBoost · LightGBM 설치
```bash
conda install scikit-learn
conda list sci   # 설치 확인

# xgboost는 conda-forge 채널 권장(최신 버전 에러가 덜 남)
conda install -c conda-forge xgboost lightgbm -y
```
```python
import sklearn; print(sklearn.__version__)
import xgboost; print(xgboost.__version__)
```

### HyperOpt 설치 시 주의
```bash
# 주피터에서 설치 후 셀 자체는 반드시 주석 처리(재실행 방지)
# !pip install hyperopt
```
```python
import hyperopt
print(hyperopt.__version__)
# ⚠️ 확인 필요: 노트에 "0.2.5 이하 버전은 numpy 2.x에서 에러 발생, 0.2.7 이상 필요"라고 적혀 있음.
#   이 프로젝트에는 hyperopt 0.3.0이 설치돼 있어 해당 버전 이슈는 해당 없음.
```

### 불균형 데이터 처리(SMOTE) 설치
```bash
conda install -c conda-forge imbalanced-learn
```

### 개인 메모
- 붓꽃(Iris) 데이터로 개념을 먼저 익히고, 실전 데이터셋(타이타닉, 피마 인디언 당뇨병, HAR, 위스콘신 유방암, 산탄데르 고객만족, 신용카드 사기, 보스턴 주택가격)으로 확장하는 순서로 학습해옴.
- 재현성을 위해 `random_state`를 거의 모든 곳에 명시하는 습관(동료와 결과를 맞추기 위함).

---

## 1. 넘파이(NumPy) 핵심

> ndarray: 넘파이의 저장소(동일 타입/연속 공간 저장) ⇒ 속도가 빠른 저장소. for문(loop) 없이 벡터 연산이라 빠름 — C언어 기반을 파이썬이 가져다 쓰는 것.

### 생성과 shape/dtype
```python
array1 = np.array([1,2,3])
print(array1.shape)   # (3,) — 1차원
print(array1.dtype)   # 하나라도 다른 타입이 섞이면 전체가 상위 타입으로 통일됨 (int+str→str, int+float→float)

array_int = np.array([1, 2, 3])
array_float = array_int.astype('float64')   # 명시적 형변환. 대용량에서 메모리 절약(float64→int32 등)에 사용
```
- `shape`: 차원별 크기를 튜플로 반환. `ndim`: 차원의 개수. **`len(shape) == ndim`이 항상 성립.**
- `arange(start, end)`, `zeros((행,열))`, `ones((행,열))`: 연속값/초기화 배열 생성.

### reshape
```python
array2 = array1.reshape(2, 5)     # 행*열 = 원소 개수여야 함
array3 = array1.reshape(-1, 5)    # -1은 자동 계산 (남는 값 없이 딱 나눠떨어져야 함, 아니면 에러)
```
> **⭐️ 머신러닝 실무 포인트**: 사이킷런의 `fit(X, y)`에서 **X는 반드시 2차원**이어야 함. 피처가 하나뿐인 1차원 데이터는 `X.reshape(-1, 1)`로 변환하는 게 표준 패턴. 반대로 예측 결과를 1차원으로 펼 때는 `reshape(-1)` 또는 `flatten()`.

### 인덱싱 4가지
- **단일값 추출**: `array1[2]`, 2차원은 `array2d[0, 1]`(행, 열).
- **슬라이싱**: `array1[0:3]`. 2차원은 `array2d[0:2, 0:2]`.
- **팬시 인덱싱**: `array2d[[0,2], 2]`처럼 비연속 여러 개 선택. ⭐️ **슬라이싱과 달리 마지막 -1 규칙이 적용 안 됨**.
- **불린 인덱싱**: `array1d[array1d > 5]` — 조건이 곧 True/False 시리즈. 실무에서 가장 많이 씀.

### 정렬
```python
sort_array1 = np.sort(org_array)          # 원본 보존, 정렬된 새 배열 반환 (ASC만 가능)
org_array.sort()                          # 원본 자체가 바뀜, 반환값은 None
sort_arr1[::-1]                           # 내림차순은 정렬 후 슬라이싱으로 처리
sort_indices = np.argsort(org_array)      # 정렬 후 "인덱스"만 반환 → 최솟값/최댓값의 위치를 알고 싶을 때
name_array[np.argsort(score_array)]       # ⭐️ 다른 배열(score)을 기준으로 이 배열(name)을 정렬하는 관용 패턴
```

### 선형대수
```python
dot_product = np.dot(A, B)          # 행렬 내적 — 정보의 유사도/영향력을 봄 (값이 클수록 유사도 높음)
transpose_mat = np.transpose(A)     # 전치 행렬 — 행과 열을 맞바꿈
```
- 스칼라(0차원) < 벡터(1차원) < 행렬(2차원) < 텐서(다차원).

---

## 2. 사이킷런 기반 프레임워크

> 모델이 바뀌어도 메서드명이 안 바뀌게 설계됨 — `fit()`(학습) → `predict()`(예측) → `accuracy_score` 등 `metrics`(평가)의 3단계는 어떤 알고리즘을 쓰든 동일.

### 주요 모듈
| 분류 | 모듈명 | 설명 |
|---|---|---|
| 예제 데이터 | `sklearn.datasets` | 내장 예제 데이터셋 |
| 피처 처리 | `sklearn.preprocessing` | 인코딩·정규화·스케일링 |
| 피처 추출 | `sklearn.feature_extraction` | 텍스트/이미지 벡터화(CountVectorizer, TfidfVectorizer 등) |
| 차원 축소 | `sklearn.decomposition` | PCA, NMF, Truncated SVD |
| 분리·검증·튜닝 | `sklearn.model_selection` | train/test 분리, 교차검증, GridSearchCV |
| 평가 | `sklearn.metrics` | 분류/회귀/클러스터링 성능 지표 |
| 앙상블 | `sklearn.ensemble` | 랜덤포레스트, 에이다부스트, 그래디언트부스팅 |
| 회귀 계열 | `sklearn.linear_model` | 선형회귀, 릿지, 라쏘, 로지스틱회귀, SGD |
| 유틸리티 | `sklearn.pipeline` | 전처리+학습을 묶어서 실행 |

### 데이터 세트 분리 → 학습 → 예측 → 평가 (전체 흐름)
```python
from sklearn.datasets import load_iris
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data, iris.target,
    test_size=0.2,       # 테스트 데이터 비율
    random_state=11      # 시드 고정 — 결과 재현을 위해 항상 넣는 습관
)

dt_clf = DecisionTreeClassifier(random_state=11)
dt_clf.fit(X_train, y_train)               # 학습
pred = dt_clf.predict(X_test)              # 예측
print(accuracy_score(y_test, pred))        # 평가
```
- ⭐️ **과적합 주의**: 학습 데이터로 학습한 모델을 같은 학습 데이터로 평가하면 정확도 1.0(100%)처럼 비현실적으로 높게 나올 수 있음 — 반드시 별도 테스트 데이터로 평가.

### 교차 검증(Cross Validation)
> 학습과 검증을 여러 번 반복하고 평균 내는 방식. 데이터는 **학습 / (학습+검증) / 테스트** 3단계로 나뉨: 학습 세트(규칙 학습), 검증 세트(도중 성능 점검·하이퍼파라미터 선택), 테스트 세트(모든 튜닝 후 최종 1회만 사용).

- **KFold**: 전체 데이터를 K개로 나눠 반복. **문제점**: 데이터가 쏠려 있으면 폴드별 정확도 편차가 크게 나옴(예: 0.73~1.0).
- **StratifiedKFold**: 레이블 분포를 유지하며 분리 — **분류(Classification)에서는 반드시 사용**. 회귀는 레이블이 연속값이라 분포를 나눌 수 없어 일반 KFold만 지원.
- **cross_val_score(estimator, X, y, scoring, cv)**: 학습→예측→점수를 한 번에 — **모델 선택할 때 사용**.
- **GridSearchCV**: 교차검증 + 하이퍼파라미터 튜닝을 한 번에 — **베스트 모델 찾기**.

```python
from sklearn.model_selection import GridSearchCV

parameters = {'max_depth': [1, 2, 3], 'min_samples_split': [2, 3]}
grid_dtree = GridSearchCV(dtree, param_grid=parameters, cv=3, refit=True)  # refit=True(기본): 베스트 파라미터로 재학습
grid_dtree.fit(X_train, y_train)

print(grid_dtree.best_params_, grid_dtree.best_score_)
estimator = grid_dtree.best_estimator_        # 이미 최적 파라미터로 학습된 모델
pred = estimator.predict(X_test)
```
> **주의**: 파라미터 조합 수 × cv 폴드 수만큼 모델을 반복 학습하므로 조합이 많아지면 매우 오래 걸림.

---

## 3. 데이터 전처리 (인코딩 · 스케일링)

### 왜 필요한가
- **결손값(NaN/Null)**: 반드시 처리해야 함 — 평균 등 대체, 결측 비율이 크면 컬럼 삭제, 중요 피처는 정밀한 대체값 필요.
- **문자열은 입력값으로 허용 안 됨** — 숫자로 변환(인코딩) 필요.
- **카테고리형 피처**는 코드값으로, **텍스트형 피처**는 벡터화로 변환.

### 데이터 인코딩
```python
from sklearn.preprocessing import LabelEncoder

# 레이블 인코딩: 카테고리형 문자열 → 코드형 숫자값 (알파벳/가나다 순 정렬 후 인덱스 부여)
items = ['TV','냉장고','전자레인지','컴퓨터','선풍기','선풍기','믹서','믹서']
encoder = LabelEncoder()
encoder.fit(items)              # ⚠️ 새로운 값이 나중에 들어오면 정렬이 다시 되면서 인덱스가 바뀜 — 주의
labels = encoder.transform(items)
encoder.inverse_transform([4, 5, 2, 0, 1, 1, 3, 3])   # 디코딩
```
- **레이블 인코딩의 문제점**: 숫자에 크기 관계(대소)가 생겨버림 — 실제로는 순서가 없는 카테고리인데 모델이 크기 차이로 오해할 수 있음.

```python
from sklearn.preprocessing import OneHotEncoder
import numpy as np

items = np.array(items).reshape(-1, 1)   # 2차원으로 변환 필요
oh_encoder = OneHotEncoder()
oh_encoder.fit(items)
oh_labels = oh_encoder.transform(items)
oh_labels.toarray()   # 희소행렬 → 밀집행렬

# 한 번에 짜는 방법(pandas)
pd.get_dummies(df)    # True/False로 나와서 잘 안 씀(노트 표현)
```
- **원-핫 인코딩**: 고유값 개수만큼 새 컬럼을 만들고 해당 값만 1, 나머지는 0 — 크기 관계 문제가 사라짐.

### 피처 스케일링과 정규화
> 서로 다른 컬럼의 "값 범위"를 일정 수준으로 맞추는 작업. 스케일링을 안 하면 값의 범위 차이 때문에 성능이 떨어지는 문제가 생김.

| 방식 | 설명 | 구현 | 결과 범위 |
|---|---|---|---|
| **표준화**(Standardization) | 평균 0, 분산 1인 가우시안 분포로 변환. `(x - 평균) / 표준편차` | `StandardScaler` | 제한 없음(대부분 -3~3) |
| **정규화**(Normalization) | 0~1 사이로 통일. `(x - 최솟값) / (최댓값 - 최솟값)` | `MinMaxScaler` | 0~1 |

```python
from sklearn.preprocessing import StandardScaler

scaler = StandardScaler()
scaler.fit(iris_df)                       # 피팅: 계산에 필요한 값(평균/분산) 구하기
iris_scaled = scaler.transform(iris_df)   # 변환: 표준화 적용 (ndarray로 반환됨 → DataFrame 재변환 필요)
```

---

## 4. 분류 모델 평가

> **정확도(Accuracy)만으로는 불균형한 레이블 데이터를 평가할 수 없다** — 불균형 여부를 항상 먼저 확인.

### 오차 행렬(Confusion Matrix)
```python
from sklearn.metrics import confusion_matrix
confusion_matrix(y_test, pred)
```
- 예측 Positive/Negative × 실제 True/False → TN, FP, FN, TP 4분면.
- **찾아야 하는(드문) 결과값을 Positive=1로 설정**하는 관례 — 암 양성=1, 사기 행위=1.

### 정밀도(Precision)와 재현율(Recall)
- **정밀도**: "예측"이 Positive인 것 중 실제로 맞은 비율(FP+TP 기준) — **이 예측을 믿을 수 있는가**.
- **재현율**: "실제" Positive 중 모델이 맞춘 비율(FN+TP 기준) — **실제 양성을 놓치지 않았는가**.
- **재현율이 중요한 경우**: 암 진단, 불량품 검출, 보험/금융 사기 탐지 — 놓치면 대가가 큼.
- **정밀도가 중요한 경우**: 스팸 메일 분류 — 정상 메일을 스팸으로 잘못 보내는 게 더 손해.
- 레이블이 불균형하지 않으면 "정확도+AUC+F1"만, **불균형하면 "정확도+정밀도+재현율+AUC+F1"**을 다 봐야 함.

```python
from sklearn.metrics import accuracy_score, precision_score, recall_score, confusion_matrix

def get_clf_eval(y_test, pred):
    confusion = confusion_matrix(y_test, pred)
    accuracy = accuracy_score(y_test, pred)
    precision = precision_score(y_test, pred)
    recall = recall_score(y_test, pred)
    print(confusion)
    print(f'정확도: {accuracy:.4f}, 정밀도: {precision:.4f}, 재현율: {recall:.4f}')
```

### 임계값 조절(트레이드오프)
> 정밀도와 재현율은 상호 보완적 — 한쪽을 강제로 높이면 다른 하나가 떨어짐(트레이드오프). 기본 임계값은 0.5.

```python
pred_proba = lr_clf.predict_proba(X_test)    # 예측 "확률" 반환 (이진분류면 0열=Negative확률, 1열=Positive확률)

from sklearn.preprocessing import Binarizer
custom_threshold = 0.4
pred_proba_1 = pred_proba[:, 1].reshape(-1, 1)
binarizer = Binarizer(threshold=custom_threshold).fit(pred_proba_1)
custom_predict = binarizer.transform(pred_proba_1)   # 임계값 기준보다 크면 1, 작으면 0
```
- 재현율을 높이고 싶으면 임계값을 낮춘다. `precision_recall_curve()`로 임계값별 정밀도/재현율 변화를 배열로 뽑을 수 있음.

### F1 스코어 · ROC-AUC
- **F1**: 정밀도와 재현율의 조화평균 — 한쪽으로 치우치지 않았는지 확인용.
- **ROC-AUC**: FPR(거짓 양성 비율)이 변할 때 TPR이 어떻게 변하는지. **AUC가 클수록 예측값의 0/1 분리도가 확실함 → 신뢰도 높음. 통상 0.85 이상이면 쓸 만한 모델.**

```python
from sklearn.metrics import roc_auc_score
roc_score = roc_auc_score(y_test, lr_clf.predict_proba(X_test)[:, 1])
```

### 결과 해석 예시 (노트에 정리된 해석 습관)
```
정밀도 47/57 → "생존"이라고 예측한 57명 중 47명이 실제 생존 → "82% 확률로 맞다"
재현율 47/61 → 실제 생존 61명 중 47명을 모델이 찾아냄 → 실제 양성을 얼마나 놓쳤는가
AUC 0.89 → 생존자·사망자를 무작위로 하나씩 뽑았을 때, 모델이 생존자에게 더 높은 확률을 줄 확률이 89%
```

---

## 5. 회귀 모델 평가

### 회귀 평가 지표
| 지표 | 설명 |
|---|---|
| MAE | 실제값-예측값 차이의 절댓값 평균 |
| MSE | 차이를 제곱해 평균 (오류가 클수록 더 크게 반영) |
| RMSE | MSE에 루트 — 실제 오류 단위로 해석 가능 |
| **R²** | 분산 기반 설명력. 1에 가까울수록 예측 정확도 높음 |
| MSLE, RMSLE | log를 적용한 오차 지표 |

`cross_val_score`/`GridSearchCV`에서 쓰는 scoring 문자열: `'neg_mean_absolute_error'`, `'neg_mean_squared_error'`, `'neg_root_mean_squared_error'`, `'neg_mean_squared_log_error'`, `'r2'`. **`neg_`가 붙는 이유**: 사이킷런의 Scoring 함수는 항상 "값이 클수록 좋다"고 자동 평가하기 때문에, 원래는 작을수록 좋은 오차 지표를 음수로 뒤집어서 반환.

### ⚠️ 확인 필요 — RMSLE를 "잘 안씀"으로 적어둔 부분
노트의 회귀 평가 지표 표에는 MSLE/RMSLE 옆에 **"잘 안씀"**이라고 적혀 있습니다. 이건 일반적인 회귀 문제 기준으로는 맞는 서술이지만, **이 프로젝트(Mercari 가격 예측처럼 타깃값이 넓은 범위·오른쪽으로 치우친 분포를 가질 때)에서는 RMSLE가 오히려 표준 지표**입니다.
- 이유: RMSLE는 로그를 취한 뒤 오차를 계산하므로, **절대 오차가 아니라 "비율 오차"에 민감**해집니다. 가격($10짜리 상품과 $1000짜리 상품의 오차 $10)을 그냥 RMSE로 재면 비싼 상품 오차가 지표를 지배하지만, RMSLE는 두 오차를 비슷한 비중으로 다룹니다.
- 실제로 캐글 Mercari Price Suggestion Challenge의 공식 평가지표가 RMSLE이고, (원본 학습 노트의) `chap08` 노트북(`rmsle()`, `evaluate_org_price()` 함수)도 이미 RMSLE를 핵심 지표로 쓰고 있습니다.
- **결론**: "RMSLE는 잘 안 쓴다"는 일반론이고, **타깃이 넓은 범위의 양수·오른쪽 치우침 분포(가격, 판매량 등)일 때는 RMSLE/MSLE를 우선 고려**해야 함을 이 문서에 보완합니다.

### 트리 기반 회귀 모델 비교 (노트의 실전 패턴)
```python
from sklearn.model_selection import cross_val_score
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.tree import DecisionTreeRegressor
from xgboost import XGBRegressor
from lightgbm import LGBMRegressor

def get_model_cv_prediction(model, X_data, y_target):
    neg_mse_scores = cross_val_score(model, X_data, y_target, scoring="neg_mean_squared_error", cv=5)
    rmse_scores = np.sqrt(-1 * neg_mse_scores)
    print(model.__class__.__name__, '평균 RMSE:', np.mean(rmse_scores))

models = [DecisionTreeRegressor(max_depth=4, random_state=0),
          RandomForestRegressor(n_estimators=1000, random_state=0),
          GradientBoostingRegressor(n_estimators=1000, random_state=0),
          XGBRegressor(n_estimators=1000),
          LGBMRegressor(n_estimators=1000)]
for model in models:
    get_model_cv_prediction(model, X_data, y_target)
```
- ⚠️ 확인 필요: 이 예제는 `sklearn.datasets.load_boston()`이 아니라 로컬 CSV(`../data/boston.csv`)를 읽는 방식으로 이미 되어 있습니다 — `load_boston()`은 데이터셋의 윤리적 문제로 scikit-learn 1.2부터 완전히 제거되어 현재(1.9.0)는 호출 시 에러가 납니다. 노트가 이미 이 이슈를 회피한 최신 방식이라 별도 수정 불필요.

### 회귀 계수 규제 — 릿지 / 라쏘 / 엘라스틱넷
> 선형회귀에서 과적합(회귀 계수 w가 너무 커짐)을 막는 방법.

| 모델 | 규제 | 효과 |
|---|---|---|
| 일반 선형회귀(LR) | 없음 | RSS만 최소화 |
| **릿지(Ridge)** | L2 | 큰 회귀계수를 0에 가깝게 축소(작은 값들도 살아남음) |
| **라쏘(Lasso)** | L1 | 영향력 작은 피처의 계수를 아예 0으로 만듦 → 피처 선택 효과 |
| **엘라스틱넷** | L1+L2 | 피처가 많을 때, L1로 개수 줄이고 L2로 크기 조정 |

```python
from sklearn.linear_model import Ridge, Lasso, ElasticNet

def get_linear_reg_eval(model_name, params, X_data_n, y_target_n):
    coeff_df = pd.DataFrame()
    for param in params:
        if model_name == 'Ridge': model = Ridge(alpha=param)
        elif model_name == 'Lasso': model = Lasso(alpha=param)
        elif model_name == 'ElasticNet': model = ElasticNet(alpha=param, l1_ratio=0.7)
        neg_mse_scores = cross_val_score(model, X_data_n, y_target_n, scoring="neg_mean_squared_error", cv=5)
        print(f'alpha {param}일 때 평균 RMSE: {np.mean(np.sqrt(-1*neg_mse_scores)):.3f}')
        model.fit(X_data_n, y_target_n)
        coeff_df[f'alpha:{param}'] = pd.Series(model.coef_, index=X_data_n.columns)
    return coeff_df
```
- `alpha`가 클수록 규제가 강해짐(회귀계수를 더 0에 가깝게).

### ⚠️ 확인 필요 — `LinearRegression(normalize=...)`
노트에 `LinearRegression`/`Ridge`의 입력 파라미터로 `normalize`(불린, 회귀 전 데이터 정규화 여부)가 설명돼 있는데, 이 프로젝트에 설치된 scikit-learn 1.9.0에서는 `LinearRegression.__init__` 시그니처에 `normalize` 파라미터가 **존재하지 않습니다**(`fit_intercept`, `copy_X`, `tol`, `n_jobs`, `positive`만 있음 — scikit-learn 1.0에서 지원 중단, 1.2에서 완전히 제거됨). 정규화가 필요하면 `Pipeline`으로 `StandardScaler`/`MinMaxScaler`를 앞에 붙이는 방식을 대신 써야 합니다.

### 다항 회귀와 데이터 변환
```python
from sklearn.preprocessing import PolynomialFeatures
poly = PolynomialFeatures(degree=2)   # 2제곱까지. 값이 클수록 복잡한 곡선(과적합 위험 ↑)
poly_ftr = poly.fit_transform(X)
```
> **회귀 모델은 정규분포를 선호** — 타깃값은 보통 로그 변환을 적용. 데이터 변환 우선순위: ① Standard/MinMax 정규화 → ② 다항 특성 추가 → **③ 로그 변환(log1p)이 실무에서 가장 많이 쓰는 방법**.

- Degree가 너무 낮으면 **과소적합**(직선처럼 단순, 오차 큼), 너무 높으면 **과적합**(회귀계수가 극단적으로 커짐, 새 데이터에 취약).

---

## 6. 분류 알고리즘 (트리 계열)

### 결정 트리(Decision Tree)
> if/else 기반으로 예측 규칙을 자동으로 찾는 알고리즘. 직관적이고 설명 가능. **전처리(스케일링/정규화)에 민감하지 않다는 장점**, 대신 **무조건 과적합되는 경향**이 단점 — 트리 크기를 제한하는 튜닝이 필수.

| 파라미터 | 설명 |
|---|---|
| `min_samples_split` | 노드를 나누기 **전** 검사. 작을수록 분할 많아짐 → 과적합 가능성 ↑ (기본 2) |
| `min_samples_leaf` | 나눈 **후** 리프가 되기 위한 최소 샘플 수. 불균형 데이터면 작게 설정 |
| `max_features` | 분할에 고려할 최대 피처 개수/비율 |
| `max_depth` | 트리 최대 깊이. None이면 끝까지 분할(과적합 위험) |
| `max_leaf_nodes` | 리프 노드 최대 개수 |

```python
from sklearn.tree import DecisionTreeClassifier, plot_tree
dt_clf = DecisionTreeClassifier(random_state=156)
dt_clf.fit(X_train, y_train)

# 피처 중요도
dt_clf.feature_importances_
```

### 앙상블: 랜덤 포레스트 / GBM / XGBoost / LightGBM
| 방식 | 원리 | 특징 |
|---|---|---|
| **배깅**(Bagging) — 랜덤 포레스트 | 같은 모델(트리) 여러 개, Soft Voting(예측 확률 평균) | 병렬처리 가능(속도 빠름), 뛰어난 예측성능/유연성 |
| **부스팅**(Boosting) — GBM | 오차를 계속 줄여나가는 반복 방식 | 수행시간이 매우 오래 걸림(순차 처리) — 💭 노트에는 "잘 안씀"으로 적혀 있음 |
| **부스팅** — XGBoost | GBM 개선판, 병렬 수행 지원 | 과적합 규제 내장, 조기중단(Early Stopping), 결손값 자체 처리. 소형데이터(1만개 이하)에서 특히 유리 |
| **부스팅** — LightGBM | 리프 중심 트리 분할(한쪽으로만 계속 분할) | XGBoost보다 2~5배 빠르고 메모리 적음. **대형 데이터에서 XGBoost보다 압도적으로 유리** |

```python
from sklearn.ensemble import RandomForestClassifier
rf_clf = RandomForestClassifier(random_state=0, n_jobs=-1)   # n_jobs=-1: CPU 전부 사용(병렬)
```

#### XGBoost — 사이킷런 래퍼 방식(권장)
```python
from xgboost import XGBClassifier

xgb_wrapper = XGBClassifier(
    n_estimators=400, learning_rate=0.1, max_depth=3,
    early_stopping_rounds=100,     # 조기중단 — 성능 개선이 없으면 지정 횟수만큼 참았다가 중단
    eval_metric="logloss",
)
evals = [(X_test, y_test)]
xgb_wrapper.fit(X_train, y_train, eval_set=evals, verbose=True)

preds = xgb_wrapper.predict(X_test)
pred_proba = xgb_wrapper.predict_proba(X_test)[:, 1]
```
- **주요 하이퍼파라미터**: `learning_rate`(0~1, 기본 0.1), `n_estimators`(모델 개수), `max_depth`(기본 6, 클수록 과적합 위험), `subsample`(데이터 샘플링 비율), `colsample_bytree`(피처 샘플링 비율), `reg_lambda`(L2), `reg_alpha`(L1), `scale_pos_weight`(불균형 데이터 균형용).
- 과적합이 심하면: `learning_rate`를 낮추고(대신 `n_estimators`는 높여서 보완), `max_depth`를 줄인다.
- ⚠️ 확인 필요: 노트에는 C 기반 네이티브 API(`xgb.DMatrix` + `xgb.train()`)도 소개돼 있으나, 노트 자체에 "Sklearn Wrapper 권장"이라고 명시돼 있음 — 이 문서도 사이킷런 래퍼(`XGBClassifier`/`XGBRegressor`) 사용을 기본값으로 삼음.

#### LightGBM
```python
from lightgbm import LGBMClassifier, early_stopping, log_evaluation

lgbm_clf = LGBMClassifier(n_estimators=500)
lgbm_clf.fit(
    X_tr, y_tr, eval_metric="auc", eval_set=[(X_tr, y_tr), (X_val, y_val)],
    callbacks=[early_stopping(stopping_rounds=100), log_evaluation(period=50)],
)
```
> 💡 이 조기중단 방식(`callbacks=[early_stopping(...), log_evaluation(...)]`)이 현재 LightGBM(4.7.0)의 표준 API입니다 — 예전 버전의 `early_stopping_rounds=` fit 파라미터 방식은 콜백 방식으로 대체됐고, 노트는 이미 최신 방식을 쓰고 있습니다.

---

## 7. (요약) 로지스틱 회귀

> 이름은 회귀지만 실제로는 **분류**에 쓰는 선형 모델. 이진 분류뿐 아니라 텍스트처럼 희소한(sparse) 데이터의 분류에서도 뛰어난 성능.

```python
from sklearn.linear_model import LogisticRegression
lr_clf = LogisticRegression(solver='liblinear')   # 소규모 데이터에 적합한 solver
lr_clf.fit(X_train, y_train)
```

### 경사 하강법(Gradient Descent) 배경 지식
- **GD**: 모든 학습 데이터로 반복적으로 오차 최소화 — 정확하지만 느림.
- **SGD**(Stochastic GD): 일부 데이터(batch)만 이용해 빠르게 업데이트 — 실무에서 더 많이 씀.
- 학습률(learning rate)이 0에 가까울수록 촘촘하게, 1에 가까울수록 넓게 내려감.

---

## 8. 불균형 데이터 처리

> 레이블(답)이 극도로 불균형(예: 사기 탐지 0.17%)하면 정확도로 평가하면 안 되고 **AUC**를 우선 본다.

### 언더샘플링 vs 오버샘플링
- **언더 샘플링**: 다수 클래스를 줄여서 균형을 맞춤 — 실제 데이터만 사용하지만 정보 손실 위험.
- **오버 샘플링**: 소수 클래스를 늘려서 균형을 맞춤 — 가상 데이터 생성.

### SMOTE (오버샘플링)
```python
from imblearn.over_sampling import SMOTE

smote = SMOTE(random_state=0)
X_train_over, y_train_over = smote.fit_resample(X_train, y_train)   # 학습 데이터에만 적용! (테스트에는 적용 X)
```

### 실전 순서 (신용카드 사기 탐지 노트 기준)
1. **분포 변환**: 금액처럼 왜곡된 분포는 `StandardScaler` 또는 `np.log1p()`로 변환. "로그 변환은 데이터 분포도가 심하게 왜곡됐을 때만" 적용.
2. **이상치 제거**: 타깃과 상관관계가 높은 피처에서 **IQR(사분위 범위)** 기준으로 이상치를 찾아 제거.
   ```python
   def get_outlier(df, column, weight=1.5):
       fraud = df[df['Class']==1][column]
       q25, q75 = np.percentile(fraud, 25), np.percentile(fraud, 75)
       iqr_weight = (q75 - q25) * weight
       return fraud[(fraud < q25 - iqr_weight) | (fraud > q75 + iqr_weight)].index
   ```
3. **SMOTE 오버샘플링**: 전처리·이상치 제거가 끝난 뒤 마지막 단계로 적용.
- ⭐️ 개인 캐치: 상관계수(`.corr()`)를 먼저 확인해서, 타깃과 상관관계가 낮은 피처는 스케일링/로그변환을 해봤자 성능에 큰 영향이 없을 수 있다는 걸 노트에서 스스로 검증(히트맵으로 시각화).

---

## 9. 하이퍼파라미터 최적화

| 방법 | 원리 | 장단점 |
|---|---|---|
| **GridSearchCV** | 지정한 값의 모든 조합을 전수 조사 | 시간 오래 걸림. 지정 범위 밖이면 최적값을 못 찾음 |
| **RandomizedSearchCV** | 검색 공간에서 무작위 n개 추출 | 더 넓게 탐색 가능하지만 성능이 운에 좌우됨 |
| **HyperOpt** | 지금까지의 (입력,결과) 쌍으로 대체모델(surrogate model)을 만들어 유망한 다음 후보를 선택(베이지안 최적화) | 적은 시도로 베스트를 찾을 수 있음(연속값 파라미터에 강함). 단, 순차 실행이라 병렬 안 됨, 무조건 최적을 보장하진 않음. **파라미터가 많고 복잡할 때 사용** |

### 💡 최신 기법 — Optuna
노트에는 GridSearch/RandomizedSearch/HyperOpt 세 가지만 나오는데, 최근 실무에서는 **Optuna**도 널리 쓰입니다. HyperOpt와 같은 베이지안 최적화 계열이지만: 검색 공간을 코드 실행 중에 동적으로 정의할 수 있고(define-by-run), 학습이 안 좋은 시도를 조기에 잘라내는 pruning 기능이 내장돼 있으며, 대시보드 시각화가 편리합니다. HyperOpt가 이미 익숙하면 계속 써도 무방하지만, 새로 시작한다면 Optuna 쪽 문서도 한 번 볼 만합니다.

### HyperOpt 4단계 준비물
1. **검색 공간**(Search Space): `hp.quniform(label, low, high, q)`(정수 필요할 때), `hp.uniform(label, low, high)`(실수 필요할 때), `hp.choice(label, options)`(문자열 선택), `hp.loguniform`.
2. **목적 함수**(Objective Function): 검색공간 딕셔너리를 받아 "이 값이 얼마나 나쁜가"를 반환 — `{'loss': retval, 'status': STATUS_OK}` 형태. **HyperOpt는 항상 최솟값을 찾으므로, 정확도처럼 클수록 좋은 지표는 `-1을 곱해서` 반환해야 함.**
3. **최적화 알고리즘**: 기본 `tpe.suggest`(Tree of Parzen Estimator).
4. **결과 저장 객체**(Trials): 매 시도의 입력값/반환값을 기록.

```python
from hyperopt import hp, fmin, tpe, Trials, STATUS_OK

xgb_search_space = {
    'max_depth': hp.quniform('max_depth', 5, 20, 1),
    'min_child_weight': hp.quniform('min_child_weight', 1, 2, 1),
    'learning_rate': hp.uniform('learning_rate', 0.01, 0.2),
    'colsample_bytree': hp.uniform('colsample_bytree', 0.5, 1),
}

def objective_func(search_space):
    xgb_clf = XGBClassifier(
        n_estimators=100,   # 탐색 단계에서는 수행 시간 절약을 위해 작게
        max_depth=int(search_space['max_depth']),          # ⚠️ fmin의 값은 전부 실수로 들어오므로 정수 파라미터는 int() 변환 필수
        min_child_weight=int(search_space['min_child_weight']),
        learning_rate=search_space['learning_rate'],
        colsample_bytree=search_space['colsample_bytree'],
        eval_metric='logloss',
    )
    accuracy = cross_val_score(xgb_clf, X_train, y_train, scoring='accuracy', cv=3)
    return {'loss': -1 * np.mean(accuracy), 'status': STATUS_OK}   # 정확도는 클수록 좋으므로 -1을 곱함

trial_val = Trials()
best = fmin(fn=objective_func, space=xgb_search_space, algo=tpe.suggest,
            max_evals=50, trials=trial_val, rstate=np.random.default_rng(seed=9))
```
- 실전 최종 학습에서는 탐색에 쓴 `n_estimators=100`보다 크게(예: 400~500) 올리고, `early_stopping_rounds`를 걸어서 다시 학습.
- k-fold를 목적 함수 안에서 직접 돌리는 패턴도 있음(3-fold로 나눠 평균 auc 계산 후 -1 곱해 반환) — `cross_val_score`로 대체 가능하지만 노트는 직접 `KFold` 루프도 실습함.

---

## 10. 차원 축소(Dimension Reduction)

> 피처(컬럼)가 매우 많아지면 데이터 포인트 간 거리가 멀어지고 희소해져서 예측 신뢰도가 떨어짐 — **전처리 단계에서 사용**(학습 자체에는 사용 안 함).

- **PCA**(주성분분석): 여러 변수 간 상관관계를 이용해 데이터를 가장 잘 설명하는 새로운 축(주성분)을 찾아 차원을 줄임. 노이즈 제거, 다중공선성 해소, 고차원 시각화에 사용. 정방행렬만 분해 가능 — 정방행렬이 아니면 SVD 사용.
- 그 외: LDA, SVD, NMF.

```python
from sklearn.decomposition import PCA
# (노트에 상세 코드는 iris 예제로 정리돼 있음 — 개념: fit_transform으로 축소된 좌표를 얻고, explained_variance_ratio_로 각 주성분이 설명하는 분산 비율을 확인)
```

---

## 11. 군집화(Clustering)

| 알고리즘 | 특징 |
|---|---|
| **K-평균**(K-means) | 가장 기본. 군집 개수(K)를 미리 정해야 함 |
| **평균 이동**(Mean Shift) | 💭 노트: "잘 안씀 → DBSCAN 더 사용" |
| **GMM**(Gaussian Mixture Model) | 데이터가 여러 개의 가우시안 분포가 섞인 것으로 가정 |
| **DBSCAN** | 밀도 기반 — 군집 개수를 미리 안 정해도 됨, 불규칙한 모양의 군집도 잘 찾음 |

### 군집 평가 — 실루엣 계수(Silhouette)
- 개별 데이터가 자기 군집 안에서는 얼마나 가깝고, 다른 군집과는 얼마나 먼지를 수치화(-1~1, 1에 가까울수록 좋음).
- 여러 K(군집 개수) 후보에 대해 실루엣 계수를 나란히 시각화해서 비교하는 함수를 노트에서 직접 작성해봄.

---

## 12. 텍스트 분석 / NLP

### 프로세스 요약
텍스트 정규화(토큰화 → 스톱워드 제거 → 정제) → **피처 벡터화** → ML 모델 적용.

### 피처 벡터화
```python
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

cnt_vec = CountVectorizer()
X_name = cnt_vec.fit_transform(df['name'])

tfidf = TfidfVectorizer(max_features=50000, ngram_range=(1,3), stop_words='english')
X_descp = tfidf.fit_transform(df['item_description'])
```
- **CountVectorizer**: 단어 등장 횟수 그대로. **TfidfVectorizer**: 자주 나오지만 변별력 없는 단어(예: the, a)의 가중치를 낮춤 — 일반적으로 분류/회귀에서 TF-IDF가 더 널리 쓰임.
- `max_features`: 단어사전 크기 제한(자주 쓰는 단어 상위 N개만). `ngram_range=(1,3)`: 1~3개 단어 묶음(uni/bi/tri-gram)까지 피처로 사용.

### 💭 노트에 "잘 안씀"으로 표시된 것들
- **BOW(Bag of Words)**: "설명 → 이젠 안씀"이라고 적혀 있음 — 개념 이해용으로만 보고, 실제로는 위 TF-IDF/Count 벡터화를 바로 사용.
- **스태킹 앙상블**: "잘 안씀, 딥러닝 방식과 비슷해서 성능 좋은 딥러닝을 대신 사용"이라고 적혀 있음.
  - 💡 최신 기법 보완: 다만 스태킹 자체가 완전히 안 쓰이는 건 아닙니다 — Kaggle 등 대회에서는 여러 GBM 계열 모델(XGBoost/LightGBM/CatBoost)을 스태킹해서 미세한 성능을 더 짜내는 경우가 여전히 흔합니다. "실무/서비스에서는 유지보수 부담 때문에 단일 강력한 모델(LightGBM 등)을 선호"하는 정도로 이해하면 노트의 서술과 상충하지 않습니다.

### 문서 유사도 (코사인 유사도)
> 두 벡터의 **내적** 기반 — RAG(검색 증강 생성)와 직접 관련 있다고 노트에 명시(추후 RAG 단계에서 재활용 예정인 개념).

### 감성 분석 / 토픽 모델링 / 문서 군집화
- 노트에 IMDB 영화평(지도학습 감성분석), 20 뉴스그룹(분류 실습 + LDA 토픽 모델링), Opinion Review 데이터셋(문서 군집화 — 이번 학기 4개 과제 데이터셋 중 "군집" 파트와 동일한 데이터셋) 예제가 정리돼 있음. 상세 코드는 노트 원본 참고.

---

## 13. [실전 사례] 캐글 Mercari Price Suggestion Challenge

> 노트 마지막에 정리된 실습이며, **베이스라인 코드 전체(결과 수치 포함)는 이 프로젝트가 아니라 Notion에 있습니다** — [참고: Mercari 베이스라인 노트북 (Ridge+LightGBM)](https://app.notion.com/p/3c2ebec5c3578107a7bae2502b708402). 이 프로젝트에는 로컬 노트북 파일이 없으니(원본은 다른 프로젝트인 `ml-dev`의 `chap08/`에만 있고 이식 대상이 아니었음), 실제 코드·베이스라인 RMSLE 수치가 필요하면 이 Notion 페이지를 기준으로 삼는다.

- **문제 정의**: 일본 대형 온라인 쇼핑몰(Mercari)의 중고거래 상품에 대해, 텍스트 특징(상품명·설명)을 활용해 적정 판매 가격을 예측(회귀). 판매자에게 예측 가격을 자동으로 제안하려는 목적.
- **전처리 순서**: 가격 로그 변환(`log1p`, 정규분포에 가깝게) → 카테고리 대/중/소 분리(`category_name.split('/')`) → 결측치를 `'Other_Null'`로 채움 → `name`/`item_description`을 CountVectorizer/TF-IDF로 벡터화 → 나머지 범주형 피처는 `LabelBinarizer(sparse_output=True)`로 원-핫 인코딩 → `scipy.sparse.hstack`으로 전부 결합.
- **평가**: `rmsle()` + `evaluate_org_price()`(로그 역변환 후 RMSLE 계산) — 5절에서 다룬 대로, 이 문제에서는 RMSLE가 "잘 안 쓰는 지표"가 아니라 **핵심 지표**임에 유의.
- **노트에 있던 모델**: Ridge(`solver="lsqr"`), LightGBM(`LGBMRegressor`) 두 개까지만 실습돼 있고, **XGBoost나 HyperOpt 튜닝은 이 실습에 포함돼 있지 않음** — 앞의 9절(HyperOpt)·6절(XGBoost)에서 다룬 내용을 이 사례에 직접 적용하는 건 이 노트가 다루지 않은, 스스로 확장해야 하는 부분.

---

## 14. 개인 컨벤션 / 항상 지키는 규칙 정리

1. **재현성 강박**: 거의 모든 함수 호출에 `random_state`(또는 `rstate`)를 명시 — "동료와 결과를 맞추기 위해"라고 스스로 적어둠.
2. **번호 붙인 print**: 판다스 학습 때와 동일하게 `print('01) ... :', 값)` 스타일을 머신러닝 노트에서도 반복 사용.
3. **학습 전 반드시 3단계**: ① 결측·불균형 확인(진단) → ② 전처리 규칙 결정 → ③ 전/후 성능 비교. — `pandas-reference.md`의 "진단→규칙→대조" 워크플로우와 동일한 습관이 머신러닝에도 이어짐.
4. **평가 함수는 항상 함수로 뽑아 재사용**: `get_clf_eval()`, `get_model_train_eval()`, `get_model_cv_prediction()`처럼 모델이 바뀌어도 그대로 재사용할 수 있는 평가 함수를 미리 만들어두는 패턴을 계속 반복.
5. **하이퍼파라미터 탐색은 항상 2단계**: 적은 `n_estimators`로 빠르게 최적 파라미터를 찾은 뒤, 마지막에만 `n_estimators`를 키워서(그리고 `early_stopping_rounds`를 걸어서) 진짜 성능을 확인.
6. **불균형 데이터는 정확도 대신 AUC**: 레이블 비율부터 확인하는 게 첫 스텝이라는 걸 여러 예제(산탄데르, 신용카드 사기)에서 반복 강조.
7. **"잘 안씀"이라고 스스로 표시해둔 기법도 지우지 않고 남겨둠**: 이해를 위해 정리는 해두되, 실전에서 우선순위가 낮다는 것도 같이 기록하는 습관 — 이 문서의 "💭 노트에 잘 안씀으로 표시" 인용들이 그 습관을 그대로 반영.

---

## 15. ⚠️ 확인 필요 목록 (한곳에 모음)

이 프로젝트에 설치된 버전(scikit-learn 1.9.0, xgboost 3.2.0, lightgbm 4.7.0, hyperopt 0.3.0) 기준, 또는 개념적으로 다시 봐야 할 부분만 모았습니다.

| # | 위치 | 내용 | 확인 필요 이유 |
|---|---|---|---|
| 1 | 회귀 평가 지표 | MSLE/RMSLE를 "잘 안씀"으로 서술 | 타깃이 넓은 범위·오른쪽 치우침 분포(가격 등)일 때는 RMSLE가 표준 지표. 이 프로젝트의 Mercari 과제가 정확히 이 경우이며, 캐글 공식 평가지표이기도 함(5절 참고) |
| 2 | 회귀(LinearRegression/Ridge) 파라미터 표 | `normalize` 파라미터가 설명돼 있음 | scikit-learn 1.0에서 지원 중단, 1.2에서 완전 제거됨. 이 프로젝트의 1.9.0에는 존재하지 않음 — `Pipeline`+`StandardScaler`로 대체 필요 |
| 3 | 보스턴 주택가격 예제 | `sklearn.datasets.load_boston()` 관련 경고 문구만 언급 | 실제로는 이미 로컬 CSV(`../data/boston.csv`)로 우회하고 있어 문제 없음(참고용으로 남김 — `load_boston()`은 1.9.0에서 호출 시 에러) |
| 4 | HyperOpt 설치 안내 | "0.2.5 이하는 numpy 2.x에서 에러" 경고 | 이 프로젝트는 hyperopt 0.3.0이 설치돼 있어 해당 없음 |
| 5 | 텍스트 분석 — BOW | "이젠 안씀"으로 서술 | 개념 설명용으로는 유효하지만, 실습 코드는 처음부터 TF-IDF/CountVectorizer로 바로 감 — 서술과 실제 코드가 일관돼 있어 모순은 아님, 참고용 표시만 |
| 6 | 앙상블 — 스태킹 | "잘 안씀, 딥러닝을 대신 사용"으로 서술 | Kaggle 등 대회에서는 GBM 계열 모델끼리의 스태킹이 여전히 흔함 — "실무 서비스에서는 유지보수 부담으로 덜 쓴다" 정도로 이해하면 큰 상충은 아님(12절 참고) |
| 7 | Mercari 실습(13절) | XGBoost·HyperOpt 튜닝이 실습에 없음 | 이 노트가 다루는 범위가 Ridge+LightGBM까지라, 이 사례(캐글 Mercari)에서 필요했던 "3개 이상 모델 비교 + 하이퍼파라미터 최적화"로의 확장은 노트 밖에서 직접 해야 함(6절 XGBoost, 9절 HyperOpt를 그대로 적용) |

---

*(이 문서는 Notion 페이지 "🎪 머신러닝(Machine Learing)"의 전체 내용을 기반으로 재구성되었습니다. 원본에 포함된 스크린샷 이미지는 텍스트 코드/설명으로 대체되어 있으므로, 이미지에만 있던 실행 결과 값(숫자·차트 등)은 이 문서에 포함되지 않았습니다. 노트 말미의 비어 있는 토글 섹션(`# 🎯 제목` 4개)과 과제 안내문 자체는 일반 ML 기법이 아니라 이 특정 과제에만 해당하는 내용이라 이 문서(포터블 레퍼런스)에는 옮기지 않았습니다.)*
