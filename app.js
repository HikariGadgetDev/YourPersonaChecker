// app.js（完全版リファクタ）

import {
    calculateScore,
    determineMBTIType,
    FUNCTIONS,
    COGNITIVE_STACKS,
    mbtiDescriptions
} from './core.js';
import { questions as originalQuestions } from './data.js';

// Fisher-Yatesシャッフル
function fisherYatesShuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// 制約付きシャッフル（同じ機能が2回連続しないように）
function shuffleQuestionsWithConstraints(questions) {
    const maxAttempts = 1000; // 無限ループ防止
    
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
    
    // 1000回試してもダメなら諦めてFisher-Yatesの結果を返す
    // （実際には数回で成功するはず）
    return fisherYatesShuffle(questions);
}

// シャッフルされた質問を使用
const questions = shuffleQuestionsWithConstraints(originalQuestions);

// ============================================
// 初期状態定義
// ============================================

const defaultState = {
    currentQuestion: 0,
    answers: {},
    functionScores: {
        Ni: 0, Ne: 0, Si: 0, Se: 0,
        Ti: 0, Te: 0, Fi: 0, Fe: 0
    },
    showResult: false
};

let state = { ...defaultState };

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

// ============================================
// イベントハンドラ（グローバル関数）
// ============================================

/**
 * 回答処理
 * @param {number} value - 選択された回答値（1-5）
 * @param {Event} event - クリックイベント
 */
window.handleAnswer = function (value, event) {
    // 連打防止：処理中は無視
    if (isProcessing) return;
    isProcessing = true;

    const question = questions[state.currentQuestion];
    const funcType = question.type;
    const oldAnswer = state.answers[question.id];

    // 前回の回答スコアを差し引く
    if (oldAnswer !== undefined) {
        state.functionScores[funcType] -= calculateScore(oldAnswer);
    }

    // 新しいスコアを加算
    const delta = calculateScore(value);
    state.answers[question.id] = value;
    state.functionScores[funcType] += delta;

    // ポップアップ演出
    showScorePopup(funcType, delta);

    // ボタンの選択状態を更新（演出用）
    if (event && event.currentTarget) {
        // 他のボタンからselectedを削除
        const buttons = document.querySelectorAll('.option');
        buttons.forEach(btn => {
            btn.classList.remove('selected');
            btn.disabled = true; // 処理中は全ボタン無効化
        });
        // クリックされたボタンにselectedを追加
        event.currentTarget.classList.add('selected');
    }

    // 次の質問へ遷移（または結果表示）
    if (state.currentQuestion < questions.length - 1) {
        setTimeout(() => {
            nextStep(() => state.currentQuestion++);
        }, 200);
    } else {
        setTimeout(() => {
            nextStep(() => state.showResult = true);
        }, 200);
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
 * 診断をリセット
 */
window.reset = function () {
    state = { ...defaultState };
    render();
};

// ============================================
// UI演出関数
// ============================================

/**
 * スコア加算時のポップアップ演出
 * @param {string} funcType - 認知機能タイプ（例: 'Ni', 'Te'）
 * @param {number} delta - 加算されたスコア
 */
function showScorePopup(funcType, delta) {
    const el = document.createElement("div");
    el.className = "score-popup";
    
    // プラスの時は +X.X、マイナスの時は -X.X（自動的に-がつく）
    const sign = delta >= 0 ? '+' : '';
    el.textContent = `${FUNCTIONS[funcType].name} ${sign}${delta.toFixed(1)}`;
    document.body.appendChild(el);

    // ランダム位置（画面中央付近）
    const x = window.innerWidth / 2 + (Math.random() * 100 - 50);
    const y = window.innerHeight / 2 + (Math.random() * 50 - 25);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    // フェードアウトアニメーション
    setTimeout(() => el.classList.add("fade-out"), 50);
    setTimeout(() => el.remove(), 1200);
}

/**
 * 状態更新後の画面遷移用ヘルパー
 * @param {Function} callback - 状態を更新するコールバック
 */
function nextStep(callback) {
    setTimeout(() => {
        callback();
        render();
        // 処理完了後、フラグをリセット
        isProcessing = false;
    }, 300);
}

// レンダリング関数

/**
 * メイン描画処理
 */
function render() {
    const container = document.getElementById('app');
    
    // 結果画面 or 質問画面を表示
    if (state.showResult) {
        renderResult(container);
    } else {
        renderQuestion(container);
        updateSidePanel(); // サイドパネルを更新
        
        // レンダリング後、選択状態を正しく反映（保険処理）
        setTimeout(() => {
            const allOptions = document.querySelectorAll('.option');
            const currentQuestion = questions[state.currentQuestion];
            allOptions.forEach(btn => {
                const btnValue = parseInt(btn.getAttribute('data-value'));
                if (state.answers[currentQuestion?.id] !== btnValue) {
                    btn.classList.remove('selected');
                }
            });
        }, 0);
    }
}

/**
 * サイドパネルの更新: 暫定MBTI出力関連
 */
function updateSidePanel() {
    // 暫定的なMBTI判定
    const provisionalResult = determineMBTIType(state.functionScores, COGNITIVE_STACKS);
    const provisionalType = provisionalResult.type;
    const provisionalDesc = mbtiDescriptions[provisionalType];
    
    // 進捗率
    const progressPercent = Math.round((state.currentQuestion / (questions.length - 1)) * 100);
    
    // スコアリスト
    const sortedScores = Object.entries(state.functionScores)
        .map(([key, val]) => ({
            key,
            value: Math.max(0, Math.round((val + 10) * 5))
        }))
        .sort((a, b) => b.value - a.value);
    
    const sidePanel = document.querySelector('.summary');
    if (!sidePanel) return;
    
    sidePanel.innerHTML = `
        <div class="provisional-mbti">
            <div class="provisional-label">暫定診断</div>
            <div class="provisional-type">${provisionalType}</div>
            <div class="provisional-name">${provisionalDesc.name}</div>
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
                    <div style="font-weight:700;min-width:48px">${item.key}</div>
                    <div style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:800;background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${item.value}</div>
                </div>
            `).join('')}
        </div>
        
        <footer class="note">回答するたびに暫定診断が更新されます</footer>
    `;
}

/**
 * タイプに応じた仮アイコンを返す（削除済み）
 */
function getCharacterIcon(type) {
    return '';
}

/**
 * 質問画面の描画
 * @param {HTMLElement} container - 描画先のコンテナ要素
 */
function renderQuestion(container) {
    const q = questions[state.currentQuestion];
    
    container.innerHTML = `
        <div class="question">
            <h3>Question ${state.currentQuestion + 1} of ${questions.length}</h3>
            <p>${q.text}</p>
            
            <div class="options">
                ${[1, 2, 3, 4, 5].map(v => `
                    <button class="option ${state.answers[q.id] === v ? 'selected' : ''}"
                            data-value="${v}"
                            onclick="handleAnswer(${v}, event)">
                        ${SCORE_LABELS[v]}
                    </button>
                `).join('')}
            </div>

            <div class="progress">
                <i style="width:${Math.round((state.currentQuestion / (questions.length - 1)) * 100)}%"></i>
            </div>

            <div class="status">
                ${Object.entries(state.functionScores).map(([key, val]) => {
                    const displayValue = Math.max(0, Math.round((val + 10) * 5));
                    return `
                        <div class="func-card">
                            <div class="func-label">${key}</div>
                            <div class="func-value">${displayValue}</div>
                            <div class="func-glow" style="opacity: ${displayValue / 100}"></div>
                        </div>
                    `;
                }).join('')}
            </div>

            ${state.currentQuestion > 0 
                ? `<button class="back-btn" onclick="goBack()">← Back</button>` 
                : ''}
        </div>
    `;
}

/**
 * 結果画面の描画
 * @param {HTMLElement} container - 描画先のコンテナ要素
 */
function renderResult(container) {
    const result = determineMBTIType(state.functionScores, COGNITIVE_STACKS);
    const mbtiType = result.type;
    const confidence = result.confidence;
    const top2 = result.top2;
    const desc = mbtiDescriptions[mbtiType];
    const secondDesc = mbtiDescriptions[top2[1]];

    // 確信度に応じたメッセージ
    const confidenceMessage = confidence >= 30 
        ? '診断結果に高い信頼性があります'
        : '複数のタイプの特性を持っています。次点タイプも参考にしてください';

    // 認知機能スコアを降順ソート
    const sortedScores = Object.entries(state.functionScores)
        .map(([key, val]) => ({
            key,
            value: Math.max(0, Math.round((val + 10) * 5)),
            func: FUNCTIONS[key]
        }))
        .sort((a, b) => b.value - a.value);

    container.innerHTML = `
        <div class="result fade-in">
            <div class="result-header">
                <div class="result-icon">🎯</div>
                <h2 class="result-title">Analysis Complete</h2>
                <p class="result-subtitle">Your cognitive profile has been identified</p>
            </div>

            <div class="result-main-card">
                <div class="mbti-badge">${mbtiType}</div>
                <h3 class="mbti-name">${desc.name}</h3>
                <p class="mbti-desc">${desc.description}</p>
                
                <div class="confidence-meter">
                    <div class="confidence-label">
                        <span>Match Confidence</span>
                        <span class="confidence-value">${confidence}%</span>
                    </div>
                    <div class="confidence-bar-bg">
                        <div class="confidence-bar-fill" style="width: ${confidence}%"></div>
                    </div>
                    <p class="confidence-message">${confidenceMessage}</p>
                </div>
            </div>

            ${confidence < 30 ? `
                <div class="secondary-type-card">
                    <h4>Alternative Type: ${top2[1]}</h4>
                    <p class="secondary-name">${secondDesc.name}</p>
                    <p class="secondary-desc">${secondDesc.description}</p>
                </div>
            ` : ''}

            <div class="function-stack-card">
                <h4 class="stack-title">Cognitive Function Stack</h4>
                <div class="stack-grid">
                    ${COGNITIVE_STACKS[mbtiType].map((f, index) => `
                        <div class="stack-item">
                            <div class="stack-rank">${['Primary', 'Auxiliary', 'Tertiary', 'Inferior'][index]}</div>
                            <div class="stack-func-name">${FUNCTIONS[f].fullName}</div>
                            <div class="stack-func-code">${FUNCTIONS[f].name}</div>
                            <div class="stack-func-desc">${FUNCTIONS[f].description}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="scores-breakdown">
                <h4 class="breakdown-title">Detailed Function Scores</h4>
                <div class="scores-grid">
                    ${sortedScores.map(item => `
                        <div class="score-card">
                            <div class="score-header">
                                <span class="score-func-code">${item.key}</span>
                                <span class="score-value">${item.value}</span>
                            </div>
                            <div class="score-func-name">${item.func.fullName}</div>
                            <div class="score-bar-mini">
                                <div class="score-bar-mini-fill" style="width: ${item.value}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="result-actions">
                <button class="btn-restart" onclick="reset()">
                    <span>Take Assessment Again</span>
                    <span class="btn-icon">↻</span>
                </button>
            </div>
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
            }, index * 100);
        });
    }, 100);
}

/**
 * 認知機能スタックのHTML生成（削除：renderResult内に統合）
 */
function getFunctionStackHTML(mbtiType) {
    return ''; // 使用しない
}

// ============================================
// 初期化
// ============================================

window.onload = render;