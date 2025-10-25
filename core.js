// core.js (修正版)

// スコア計算（非線形ウェイト + 逆転項目対応）
export function calculateScore(value, isReverse = false) {
    // 逆転項目の場合はスコアを反転（5→1, 4→2, 3→3, 2→4, 1→5）
    const actualValue = isReverse ? (6 - value) : value;
    
    // 中央値3を基準に非線形スコアを算出
    // 強い同意・強い不同意をより強調
    const base = actualValue - 3; // -2, -1, 0, +1, +2
    const weight = Math.sign(base) * Math.pow(Math.abs(base), 1.2);
    return weight;
}

// MBTIタイプ判定（確信度付き）
export function determineMBTIType(functionScores, COGNITIVE_STACKS) {
    const typeScores = {};

    for (const [type, stack] of Object.entries(COGNITIVE_STACKS)) {
        const weights = [4, 2, 1, 0.5]; // 機能スタックの重要度
        let totalScore = 0;

        for (let i = 0; i < stack.length; i++) {
            const func = stack[i];
            totalScore += (functionScores[func] || 0) * weights[i];
        }
        typeScores[type] = totalScore;
    }

    // スコアを降順にソート
    const sorted = Object.entries(typeScores).sort((a, b) => b[1] - a[1]);

    const best = sorted[0];
    const second = sorted[1];
    const confidence =
        Math.round(
            100 *
                ((best[1] - second[1]) /
                    (Math.abs(best[1]) + Math.abs(second[1]) + 1e-6))
        );

    return {
        type: best[0],
        confidence: Math.max(0, Math.min(confidence, 100)),
        top2: [best[0], second[0]],
        typeScores: typeScores
    };
}

// 認知機能・タイプ定義
export const FUNCTIONS = {
    Ni: { name: 'Ni', fullName: '内向的直観', description: '洞察と未来予測' },
    Ne: { name: 'Ne', fullName: '外向的直観', description: '可能性の探求' },
    Si: { name: 'Si', fullName: '内向的感覚', description: '経験と伝統' },
    Se: { name: 'Se', fullName: '外向的感覚', description: '現在の体験' },
    Ti: { name: 'Ti', fullName: '内向的思考', description: '論理的分析' },
    Te: { name: 'Te', fullName: '外向的思考', description: '効率的実行' },
    Fi: { name: 'Fi', fullName: '内向的感情', description: '個人的価値' },
    Fe: { name: 'Fe', fullName: '外向的感情', description: '調和と共感' }
};

// 16タイプの認知機能スタック
export const COGNITIVE_STACKS = {
    INTJ: ['Ni', 'Te', 'Fi', 'Se'],
    INTP: ['Ti', 'Ne', 'Si', 'Fe'],
    ENTJ: ['Te', 'Ni', 'Se', 'Fi'],
    ENTP: ['Ne', 'Ti', 'Fe', 'Si'],
    INFJ: ['Ni', 'Fe', 'Ti', 'Se'],
    INFP: ['Fi', 'Ne', 'Si', 'Te'],
    ENFJ: ['Fe', 'Ni', 'Se', 'Ti'],
    ENFP: ['Ne', 'Fi', 'Te', 'Si'],
    ISTJ: ['Si', 'Te', 'Fi', 'Ne'],
    ISFJ: ['Si', 'Fe', 'Ti', 'Ne'],
    ESTJ: ['Te', 'Si', 'Ne', 'Fi'],
    ESFJ: ['Fe', 'Si', 'Ne', 'Ti'],
    ISTP: ['Ti', 'Se', 'Ni', 'Fe'],
    ISFP: ['Fi', 'Se', 'Ni', 'Te'],
    ESTP: ['Se', 'Ti', 'Fe', 'Ni'],
    ESFP: ['Se', 'Fi', 'Te', 'Ni']
};

// タイプ説明
export const mbtiDescriptions = {
    INTJ: { name: "建築家", description: "戦略的思考と革新的な洞察力を持つ完璧主義者。" },
    INTP: { name: "論理学者", description: "知的好奇心に満ちた思考家。" },
    ENTJ: { name: "指揮官", description: "明確なビジョンを持ち組織を導くリーダー。" },
    ENTP: { name: "討論者", description: "創造的な発想で新しい可能性を追求する革新者。" },
    INFJ: { name: "提唱者", description: "理想主義で深い洞察を持つビジョナリー。" },
    INFP: { name: "仲介者", description: "誠実で情熱的な理想主義者。" },
    ENFJ: { name: "主人公", description: "人々を鼓舞し導くカリスマ的リーダー。" },
    ENFP: { name: "運動家", description: "自由で創造的、熱意あふれる探求者。" },
    ISTJ: { name: "管理者", description: "責任感が強く信頼できる実務家。" },
    ISFJ: { name: "擁護者", description: "温かく献身的な保護者。" },
    ESTJ: { name: "幹部", description: "組織化と効率を重んじる実践的リーダー。" },
    ESFJ: { name: "領事官", description: "社交的で思いやりのある世話役。" },
    ISTP: { name: "巨匠", description: "現実的で即応力のある問題解決者。" },
    ISFP: { name: "冒険家", description: "柔軟で芸術的な探求者。" },
    ESTP: { name: "起業家", description: "大胆で行動的な実践家。" },
    ESFP: { name: "エンターテイナー", description: "陽気で社交的なパフォーマー。" }
};