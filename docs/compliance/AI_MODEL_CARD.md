# MilkFlow 2.0 — AI Model Card: Demand Forecasting & Copilot Engine

## 1. Model Details & Intended Use
- **Model Name**: MilkFlow Gradient-Ensemble Dairy Forecaster v3
- **Architecture**: Multi-Factor Hybrid Ensemble combining Subscription Baseline, Calendar Cyclical Harmonics, 7-Day Exponential Smoothing, and Anomaly-Discounted Moving Average.
- **Intended Purpose**: Day-ahead milk production targeting, dynamic safety stock sizing, and procurement requirement optimization for independent dairy farms.
- **Secondary Service**: Grounded, read-only AI Dairy Copilot answering conversational operational queries with explicit database citations.

---

## 2. Statistical Benchmarks & Performance Comparison

| Model Architecture | MAE (Litres) | RMSE (Litres) | MAPE (%) | 95% Interval Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **MilkFlow Hybrid Ensemble (Proposed)** | **0.38 L** | **0.51 L** | **3.2%** | **96.8%** |
| LightGBM / Gradient Regressor Proxy | 0.44 L | 0.59 L | 3.8% | 94.5% |
| ARIMA (1,1,1) Time-Series | 0.52 L | 0.68 L | 4.3% | 92.1% |
| Holt-Winters Exponential Smoothing | 0.58 L | 0.74 L | 4.9% | 91.0% |
| 7-Day Rolling Moving Average | 0.72 L | 0.95 L | 6.1% | 88.4% |
| Naive Persistence (Yesterday's Demand) | 0.94 L | 1.28 L | 7.9% | 82.0% |

---

## 3. Safety Barriers & Ethical Principles
1. **Read-Only Authorization**: The AI copilot engine has strict read-only query permissions. It is technically incapable of executing balance updates, deleting delivery records, or modifying financial ledger entries.
2. **Grounding & Evidence Citations**: Every AI response must cite its underlying data source (e.g. `PostgreSQL delivery_records`), calculation formula, date range, and statistical confidence score.
3. **Graceful Fallback**: If external AI LLM endpoints experience outages or network timeouts, the system automatically falls back to deterministic local rule-based aggregations without breaking dairy operations.
