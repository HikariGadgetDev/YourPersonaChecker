// app.js (完全版 - 逆転項目対応 + 状態管理改善 + 暫定診断閾値対応 + XSS対策)

import {
    calculateScore,
    determineMBTIType,
    FUNCTIONS,
    COGNITIVE_STACKS,
    mbtiDescriptions
} from './core.js';
import { questions as originalQuestions } from './data.js';



// ============================================
// セキュリティ: HTMLサニタイズ関数
// ============================================

/**
 * テキストをHTMLエスケープ（XSS対策）
 * 注: 現在は静的データのみだが、将来的な拡張に備えて実装
 * @param {string} text - エスケープするテキスト
 * @returns {string} エスケープされたHTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// 質問のシャッフル処理
// ============================================

// Fisher-Yatesシャッフル
function fisherYatesShuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// 制約付きシャッフル(同じ機能が2回連続しないように)
function shuffleQuestionsWithConstraints(questions) {
    const maxAttempts = 1000;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const shuffled = fisherYatesShuffle(questions);
        
        // 連続チェック
        let hasConsecutive = false;
        for (let i = 1; i < shuffled.length; i++) {
            if (shuffled[i].type === shuffled[i - 1].type) {
                hasConsecutive = true;
                break;
            }
        }
        
        // 連続がなければ採用
        if (!hasConsecutive) {
            return shuffled;
        }
    }
    
    // フォールバック: 1000回試してもダメなら通常のシャッフル結果を返す
    console.warn('制約付きシャッフルが1000回で完了しませんでした。通常のシャッフル結果を使用します。');
    return fisherYatesShuffle(questions);
}

// シャッフルされた質問を使用
const questions = shuffleQuestionsWithConstraints(originalQuestions);

// ============================================
// 初期状態定義（ディープコピー対応）
// ============================================

// ファクトリー関数で毎回新しいオブジェクトを生成
const createDefaultState = () => ({
    currentQuestion: 0,
    answers: {},
    functionScores: {
        Ni: 0, Ne: 0, Si: 0, Se: 0,
        Ti: 0, Te: 0, Fi: 0, Fe: 0
    },
    showResult: false
});

let state = createDefaultState();

// 処理中フラグ（連打防止用）
let isProcessing = false;

// ============================================
// 定数定義
// ============================================

const SCORE_LABELS = {
    1: "全くそう思わない",
    2: "あまりそう思わない",
    3: "どちらともいえない",
    4: "ややそう思う",
    5: "とてもそう思う"
};

// スコア正規化定数
// 理論値: 各機能8問 × 最大±2.3 ≒ ±18.4
// 実用的な範囲として -20 ~ +20 を想定し、0-100に正規化
const SCORE_MIN = -20;
const SCORE_MAX = 20;

// 暫定診断を表示する最低回答数（1機能分 = 8問）
const MIN_ANSWERS_FOR_PROVISIONAL = 8;

// アニメーション遅延時間（ミリ秒）
const ANIMATION_DELAY = {
    BUTTON_FEEDBACK: 200,      // ボタン選択後のフィードバック時間
    SCREEN_TRANSITION: 300,    // 画面遷移時の待機時間
    POPUP_FADE_START: 50,      // スコアポップアップのフェード開始
    POPUP_REMOVE: 1200,        // スコアポップアップの削除タイミング
    RESULT_STAGGER: 100        // 結果画面の要素表示間隔
};

function normalizeScore(rawScore) {
    return Math.max(0, Math.min(100, 
        Math.round(((rawScore - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100)
    ));
}

// ============================================
// イベントハンドラ（グローバル関数）
// ============================================

/**
 * 回答処理（逆転項目対応版）
 * @param {number} value - 選択された回答値（1-5）
 * @param {Event} event - クリックイベント
 */
window.handleAnswer = function (value, event) {
    // 連打防止：処理中は無視
    if (isProcessing) return;
    isProcessing = true;

    const question = questions[state.currentQuestion];
    const funcType = question.type;
    const isReverse = question.reverse || false; // 逆転項目フラグ
    const oldAnswer = state.answers[question.id];

    // 前回の回答スコアを差し引く（逆転項目考慮）
    if (oldAnswer !== undefined) {
        const oldAnswerData = state.answers[question.id];
        const oldScore = calculateScore(
            typeof oldAnswerData === 'object' ? oldAnswerData.value : oldAnswerData, 
            isReverse
        );
        state.functionScores[funcType] -= oldScore;
    }

    // 新しいスコアを加算（逆転項目考慮）
    const delta = calculateScore(value, isReverse);
    
    // 回答を保存（値と逆転フラグを両方保存）
    state.answers[question.id] = {
        value: value,
        isReverse: isReverse
    };
    
    state.functionScores[funcType] += delta;

    // ポップアップ演出
    showScorePopup(funcType, delta, isReverse);

    // ボタンの選択状態を更新
    if (event && event.currentTarget) {
        const buttons = document.querySelectorAll('.option');
        buttons.forEach(btn => {
            btn.classList.remove('selected');
            btn.disabled = true;
        });
        event.currentTarget.classList.add('selected');
    }

    // 次の質問へ遷移（または結果表示）
    if (state.currentQuestion < questions.length - 1) {
        setTimeout(() => {
            nextStep(() => state.currentQuestion++);
        }, ANIMATION_DELAY.BUTTON_FEEDBACK);
    } else {
        setTimeout(() => {
            nextStep(() => state.showResult = true);
        }, ANIMATION_DELAY.BUTTON_FEEDBACK);
    }
};

/**
 * 前の質問に戻る
 */
window.goBack = function () {
    if (state.currentQuestion > 0 && !isProcessing) {
        state.currentQuestion--;
        render();
    }
};

/**
 * 診断をリセット（ディープコピー版）
 */
window.reset = function () {
    state = createDefaultState(); // 新しいオブジェクトを生成
    render();
};

/**
 * キーボードナビゲーション処理
 * @param {KeyboardEvent} event - キーボードイベント
 * @param {number} currentValue - 現在のボタンの値
 */
window.handleKeyboardNavigation = function (event, currentValue) {
    const options = Array.from(document.querySelectorAll('.option'));
    const currentIndex = options.findIndex(btn => parseInt(btn.dataset.value) === currentValue);
    
    let nextIndex = currentIndex;
    
    switch(event.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
            event.preventDefault();
            nextIndex = Math.max(0, currentIndex - 1);
            break;
        case 'ArrowDown':
        case 'ArrowRight':
            event.preventDefault();
            nextIndex = Math.min(options.length - 1, currentIndex + 1);
            break;
        case 'Enter':
        case ' ':
            event.preventDefault();
            handleAnswer(currentValue, event);
            return;
        case 'Home':
            event.preventDefault();
            nextIndex = 0;
            break;
        case 'End':
            event.preventDefault();
            nextIndex = options.length - 1;
            break;
        default:
            return;
    }
    
    if (nextIndex !== currentIndex && options[nextIndex]) {
        options[nextIndex].focus();
        // tabindexを更新（ラジオグループのフォーカス管理）
        options.forEach((opt, idx) => {
            opt.tabIndex = idx === nextIndex ? 0 : -1;
        });
    }
};

// ============================================
// UI演出関数
// ============================================

/**
 * スコア加算時のポップアップ演出（逆転項目表示対応）
 * @param {string} funcType - 認知機能タイプ
 * @param {number} delta - 加算されたスコア
 * @param {boolean} isReverse - 逆転項目かどうか
 */
function showScorePopup(funcType, delta, isReverse) {
    const el = document.createElement("div");
    el.className = "score-popup";
    
    const sign = delta >= 0 ? '+' : '';
    const reverseIndicator = isReverse ? ' (R)' : '';
    el.textContent = `${FUNCTIONS[funcType].name} ${sign}${delta.toFixed(1)}${reverseIndicator}`;
    
    document.body.appendChild(el);

    // ランダム位置（画面中央付近）
    const x = window.innerWidth / 2 + (Math.random() * 100 - 50);
    const y = window.innerHeight / 2 + (Math.random() * 50 - 25);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    // フェードアウトアニメーション
    setTimeout(() => el.classList.add("fade-out"), ANIMATION_DELAY.POPUP_FADE_START);
    setTimeout(() => el.remove(), ANIMATION_DELAY.POPUP_REMOVE);
}

/**
 * 状態更新後の画面遷移用ヘルパー
 * @param {Function} callback - 状態を更新するコールバック
 */
function nextStep(callback) {
    setTimeout(() => {
        callback();
        render();
        isProcessing = false;
    }, ANIMATION_DELAY.SCREEN_TRANSITION);
}

// ============================================
// レンダリング関数
// ============================================

/**
 * メイン描画処理
 */
function render() {
    const container = document.getElementById('app');
    
    if (state.showResult) {
        renderResult(container);
    } else {
        renderQuestion(container);
        updateSidePanel();
        
        // 選択状態を正しく反映
        setTimeout(() => {
            const allOptions = document.querySelectorAll('.option');
            const currentQuestion = questions[state.currentQuestion];
            const savedAnswer = state.answers[currentQuestion?.id];
            allOptions.forEach(btn => {
                const btnValue = parseInt(btn.getAttribute('data-value'));
                const actualValue = savedAnswer ? savedAnswer.value : undefined;
                if (actualValue !== btnValue) {
                    btn.classList.remove('selected');
                }
            });
        }, 0);
    }
}

/**
 * サイドパネルの更新（暫定診断閾値対応）
 */
function updateSidePanel() {
    const answeredCount = Object.keys(state.answers).length;
    const progressPercent = Math.round((state.currentQuestion / Math.max(1, questions.length - 1)) * 100);
    
    // スコアリストは常に表示
    const sortedScores = Object.entries(state.functionScores)
        .map(([key, val]) => ({
            key,
            value: normalizeScore(val)
        }))
        .sort((a, b) => b.value - a.value);
    
    const sidePanel = document.querySelector('.summary');
    if (!sidePanel) return;
    
    // 最低8問（1機能分）回答するまで暫定診断は非表示
    if (answeredCount < MIN_ANSWERS_FOR_PROVISIONAL) {
        sidePanel.innerHTML = `
            <div class="provisional-mbti">
                <div class="provisional-label">暫定診断</div>
                <div style="padding:32px 16px;text-align:center;">
                    <div style="font-size:48px;margin-bottom:12px;opacity:0.3;">❓</div>
                    <div style="font-size:14px;color:var(--text-muted);line-height:1.6;">
                        より正確な診断のため<br>
                        質問に回答してください
                    </div>
                </div>
                <div class="provisional-progress">${progressPercent}% complete</div>
            </div>
            
            <div class="character-preview">
                <div class="character-placeholder">
                    <div class="character-label">キャラクター画像</div>
                    <div class="character-note">友達が描いてくれる予定</div>
                </div>
            </div>
            
            <div class="score-list" id="scoreList">
                ${sortedScores.map(item => `
                    <div class="score-item">
                        <div style="font-weight:700;min-width:48px">${escapeHtml(item.key)}</div>
                        <div style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:800;background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${item.value}</div>
                    </div>
                `).join('')}
            </div>
            
            <footer class="note">回答数: ${answeredCount} / ${questions.length}</footer>
        `;
        return;
    }
    
    // 8問以上回答済み → 暫定診断を表示
    const provisionalResult = determineMBTIType(state.functionScores, COGNITIVE_STACKS);
    const provisionalType = provisionalResult.type;
    const provisionalDesc = mbtiDescriptions[provisionalType];
    
    sidePanel.innerHTML = `
        <div class="provisional-mbti">
            <div class="provisional-label">暫定診断</div>
            <div class="provisional-type">${escapeHtml(provisionalType)}</div>
            <div class="provisional-name">${escapeHtml(provisionalDesc.name)}</div>
            <div class="provisional-progress">${progressPercent}% complete</div>
        </div>
        
        <div class="character-preview">
            <div class="character-placeholder">
                <div class="character-label">キャラクター画像</div>
                <div class="character-note">友達が描いてくれる予定</div>
            </div>
        </div>
        
        <div class="score-list" id="scoreList">
            ${sortedScores.map(item => `
                <div class="score-item">
                    <div style="font-weight:700;min-width:48px">${escapeHtml(item.key)}</div>
                    <div style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:800;background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${item.value}</div>
                </div>
            `).join('')}
        </div>
        
        <footer class="note">回答するたびに暫定診断が更新されます</footer>
    `;
}

/**
 * 質問画面の描画
 */
function renderQuestion(container) {
    const q = questions[state.currentQuestion];
    const savedAnswer = state.answers[q.id];
    const currentValue = savedAnswer ? savedAnswer.value : undefined;
    
    container.innerHTML = `
        <div class="question" role="form" aria-label="MBTI診断質問フォーム">
            <h3 id="question-number">Question ${state.currentQuestion + 1} of ${questions.length}</h3>
            <p id="question-text" role="heading" aria-level="2">${escapeHtml(q.text)}${q.reverse ? ' <span style="color:var(--accent);font-size:0.9em">(逆転項目)</span>' : ''}</p>
            
            <div class="options" role="radiogroup" aria-labelledby="question-text" aria-describedby="question-number">
                ${[1, 2, 3, 4, 5].map((v, index) => `
                    <button class="option ${currentValue === v ? 'selected' : ''}"
                            role="radio"
                            aria-checked="${currentValue === v ? 'true' : 'false'}"
                            aria-label="${escapeHtml(SCORE_LABELS[v])} (5段階評価の${v})"
                            data-value="${v}"
                            tabindex="${currentValue === v ? '0' : (currentValue === undefined && index === 0 ? '0' : '-1')}"
                            onclick="handleAnswer(${v}, event)"
                            onkeydown="handleKeyboardNavigation(event, ${v})">
                        ${escapeHtml(SCORE_LABELS[v])}
                    </button>
                `).join('')}
            </div>

            <div class="progress" role="progressbar" aria-valuenow="${progressPercent()}" aria-valuemin="0" aria-valuemax="100" aria-label="診断の進捗状況">
                <i style="width:${progressPercent()}%"></i>
            </div>

            <div class="status" role="region" aria-label="認知機能スコア">
                ${Object.entries(state.functionScores).map(([key, val]) => {
                    const displayValue = normalizeScore(val);
                    return `
                        <div class="func-card" role="status" aria-label="${escapeHtml(key)}機能: ${displayValue}ポイント">
                            <div class="func-label">${escapeHtml(key)}</div>
                            <div class="func-value">${displayValue}</div>
                            <div class="func-glow" style="opacity: ${displayValue / 100}" aria-hidden="true"></div>
                        </div>
                    `;
                }).join('')}
            </div>

            ${state.currentQuestion > 0 
                ? `<button class="back-btn" onclick="goBack()" aria-label="前の質問に戻る">← Back</button>` 
                : ''}
            
            <footer class="app-footer">
                © ${new Date().getFullYear()} Cognitive Function Analysis • For educational purposes
            </footer>
        </div>
    `;
    
    // キーボードナビゲーション: 最初の選択肢または選択済みの選択肢にフォーカス
    setTimeout(() => {
        const selectedOption = container.querySelector('.option[aria-checked="true"]');
        const firstOption = container.querySelector('.option');
        (selectedOption || firstOption)?.focus();
    }, 0);
}

/**
 * 進捗率計算
 */
function progressPercent() {
    if (questions.length <= 1) return 100;
    return Math.round((state.currentQuestion / (questions.length - 1)) * 100);
}

/**
 * 結果画面の描画
 */
function renderResult(container) {
    const result = determineMBTIType(state.functionScores, COGNITIVE_STACKS);
    const mbtiType = result.type;
    const confidence = result.confidence;
    const top2 = result.top2;
    const desc = mbtiDescriptions[mbtiType];
    const secondDesc = mbtiDescriptions[top2[1]];

    const confidenceMessage = confidence >= 30 
        ? '診断結果に高い信頼性があります'
        : '複数のタイプの特性を持っています。次点タイプも参考にしてください';

    const sortedScores = Object.entries(state.functionScores)
        .map(([key, val]) => ({
            key,
            value: normalizeScore(val),
            func: FUNCTIONS[key]
        }))
        .sort((a, b) => b.value - a.value);

    container.innerHTML = `
        <div class="result fade-in" role="article" aria-labelledby="result-title">
            <div class="result-header">
                <h2 id="result-title" class="result-title">Analysis Complete</h2>
                <p class="result-subtitle">Your cognitive profile has been identified</p>
            </div>

            <div class="result-main-card" role="region" aria-labelledby="mbti-type">
                <div id="mbti-type" class="mbti-badge" role="heading" aria-level="1">${escapeHtml(mbtiType)}</div>
                <h3 class="mbti-name">${escapeHtml(desc.name)}</h3>
                <p class="mbti-desc">${escapeHtml(desc.description)}</p>
                
                <div class="confidence-meter" role="region" aria-label="診断結果の信頼度">
                    <div class="confidence-label">
                        <span>Match Confidence</span>
                        <span class="confidence-value">${confidence}%</span>
                    </div>
                    <div class="confidence-bar-bg" role="progressbar" aria-valuenow="${confidence}" aria-valuemin="0" aria-valuemax="100">
                        <div class="confidence-bar-fill" style="width: ${confidence}%"></div>
                    </div>
                    <p class="confidence-message">${escapeHtml(confidenceMessage)}</p>
                </div>
            </div>

            ${confidence < 30 ? `
                <div class="secondary-type-card" role="complementary" aria-label="次点タイプ">
                    <h4>Alternative Type: ${escapeHtml(top2[1])}</h4>
                    <p class="secondary-name">${escapeHtml(secondDesc.name)}</p>
                    <p class="secondary-desc">${escapeHtml(secondDesc.description)}</p>
                </div>
            ` : ''}

            <div class="function-stack-card" role="region" aria-labelledby="stack-title">
                <h4 id="stack-title" class="stack-title">Cognitive Function Stack</h4>
                <div class="stack-grid">
                    ${COGNITIVE_STACKS[mbtiType].map((f, index) => `
                        <div class="stack-item" role="article">
                            <div class="stack-rank">${escapeHtml(['Primary', 'Auxiliary', 'Tertiary', 'Inferior'][index])}</div>
                            <div class="stack-func-name">${escapeHtml(FUNCTIONS[f].fullName)}</div>
                            <div class="stack-func-code">${escapeHtml(FUNCTIONS[f].name)}</div>
                            <div class="stack-func-desc">${escapeHtml(FUNCTIONS[f].description)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="scores-breakdown" role="region" aria-labelledby="breakdown-title">
                <h4 id="breakdown-title" class="breakdown-title">Detailed Function Scores</h4>
                <div class="scores-grid">
                    ${sortedScores.map(item => `
                        <div class="score-card" role="article" aria-label="${escapeHtml(item.func.fullName)}: ${item.value}ポイント">
                            <div class="score-header">
                                <span class="score-func-code">${escapeHtml(item.key)}</span>
                                <span class="score-value">${item.value}</span>
                            </div>
                            <div class="score-func-name">${escapeHtml(item.func.fullName)}</div>
                            <div class="score-bar-mini" role="progressbar" aria-valuenow="${item.value}" aria-valuemin="0" aria-valuemax="100">
                                <div class="score-bar-mini-fill" style="width: ${item.value}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="result-actions">
                <button class="btn-restart" onclick="reset()" aria-label="診断を最初からやり直す">
                    <span>Take Assessment Again</span>
                    <span class="btn-icon" aria-hidden="true">↻</span>
                </button>
            </div>
            
            <footer class="app-footer">
                © ${new Date().getFullYear()} Cognitive Function Analysis • Based on Jungian theory
            </footer>
        </div>
    `;

    // 登場アニメーション
    setTimeout(() => {
        document.querySelectorAll('.result > *').forEach((el, index) => {
            setTimeout(() => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(20px)';
                el.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                setTimeout(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, 50);
            }, index * ANIMATION_DELAY.RESULT_STAGGER);
        });
    }, ANIMATION_DELAY.RESULT_STAGGER);
}

// ============================================
// 初期化
// ============================================

window.onload = render;