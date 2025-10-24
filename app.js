// app.js（完全版リファクタ）

import {
    calculateScore,
    determineMBTIType,
    FUNCTIONS,
    COGNITIVE_STACKS,
    mbtiDescriptions
} from './core.js';
import { questions } from './data.js';

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
    el.textContent = `${FUNCTIONS[funcType].name} +${delta.toFixed(1)}`;
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

// ============================================
// レンダリング関数
// ============================================

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

    // 次点タイプの表示ブロック
    const secondBlock = secondDesc
        ? `<div class="secondary-type">
               <h4>次点タイプ: ${top2[1]} (${secondDesc.name})</h4>
               <p>${secondDesc.description}</p>
           </div>`
        : '';

    container.innerHTML = `
        <div class="result">
            <h2>あなたのタイプは <span class="mbti">${mbtiType}</span> (${desc.name})</h2>
            <p>${desc.description}</p>

            <div class="confidence">
                <p><strong>確信度:</strong> ${confidence}%</p>
                ${confidence < 20 
                    ? '<p>⚠ 判定が接近しています。次点タイプも参考にしてください。</p>' 
                    : ''}
            </div>

            ${secondBlock}
            ${getFunctionStackHTML(mbtiType)}
            
            <button onclick="reset()">もう一度診断する</button>
        </div>
    `;
}

/**
 * 認知機能スタックのHTML生成
 * @param {string} mbtiType - MBTIタイプ（例: 'INTJ'）
 * @returns {string} スタック表示用のHTML
 */
function getFunctionStackHTML(mbtiType) {
    const stack = COGNITIVE_STACKS[mbtiType];
    if (!stack) return '';
    
    return `
        <div class="stack">
            <h4>主要な認知機能スタック</h4>
            <ul>
                ${stack.map(f => `
                    <li>
                        <strong>${FUNCTIONS[f].fullName}</strong> (${FUNCTIONS[f].name})：
                        ${FUNCTIONS[f].description}
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

// ============================================
// 初期化
// ============================================

window.onload = render;