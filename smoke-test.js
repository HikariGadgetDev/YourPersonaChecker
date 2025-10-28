// smoke-test.js

// 【実行方法】
// 1. ターミナルでこのディレクトリに移動:
//    cd C:\Users\YourName\Projects\mbti-app

// 2. 以下を実行:
//    node smoke-test.js

// 【正常時の出力例】
//    🔥 スモークテスト開始...
//    ✅ スモークテスト完了 - すべて正常

// 【エラー時の出力例】
//    ❌ スモークテスト失敗
//    計算結果異常: score5=...

import {
  calculateScore,
  determineMBTIType,
  validateConstants,
  COGNITIVE_STACKS
} from './core.js';

console.log('🔥 スモークテスト開始...\n');

try {
  // テスト1: 定数の整合性
  console.log('📐 定数チェック...');
  if (!validateConstants()) {
    throw new Error('定数の整合性チェック失敗');
  }
  console.log('  ✓ 定数OK\n');

  // テスト2: 基本的な計算
  console.log('🧮 計算ロジック...');
  const score5 = calculateScore(5, false);
  const score1 = calculateScore(1, false);
  if (score5 <= 0 || score1 >= 0) {
    throw new Error(`計算結果異常: score5=${score5}, score1=${score1}`);
  }
  console.log(`  ✓ 肯定スコア: ${score5.toFixed(2)}`);
  console.log(`  ✓ 否定スコア: ${score1.toFixed(2)}\n`);

  // テスト3: 逆転項目
  console.log('🔄 逆転項目...');
  const reverseScore = calculateScore(5, true);
  if (reverseScore >= 0) {
    throw new Error(`逆転項目が機能していません: ${reverseScore}`);
  }
  console.log(`  ✓ 逆転スコア: ${reverseScore.toFixed(2)}\n`);

  // テスト4: タイプ判定
  console.log('🎯 タイプ判定...');
  const mockScores = {
    Ni: 15, Ne: -5, Si: -10, Se: -15,
    Ti: 10, Te: 5, Fi: -5, Fe: 0
  };
  const result = determineMBTIType(mockScores, COGNITIVE_STACKS);
  
  if (!result.type || !result.type.match(/^[A-Z]{4}$/)) {
    throw new Error(`無効なタイプ: ${result.type}`);
  }
  if (result.confidence < 0 || result.confidence > 100) {
    throw new Error(`確信度が範囲外: ${result.confidence}`);
  }
  
  console.log(`  ✓ 判定タイプ: ${result.type}`);
  console.log(`  ✓ 確信度: ${result.confidence}%\n`);

  // すべて成功
  console.log('✅ スモークテスト完了 - すべて正常\n');
  process.exit(0);

} catch (error) {
  console.error('❌ スモークテスト失敗\n');
  console.error(error.message);
  console.error('\n詳細:', error.stack);
  process.exit(1);
}