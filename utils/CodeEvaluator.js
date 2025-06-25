// Simplified CodeEvaluator - Much faster
const axios = require('axios');

class CodeEvaluator {
  constructor() {
    this.executorUrl = process.env.CODE_EXECUTOR_URL || 'http://localhost:3001';
  }

  async evaluateCode(code, problem) {
    if (!code?.trim()) return 0;

    const language = this.detectLanguage(code);

    // Check if it's just starter code
    if (code.includes('// Your code here') && code.split('\n').length <= 5) {
        return 5; // Very low score for unchanged starter code
    }

    // Execute for main points first (this is the primary scoring)
    let executionScore = 0;
    try {
        executionScore = await Promise.race([
            this.executeCode(code, language, problem.testCases || []),
            new Promise(resolve => setTimeout(() => resolve(0), 12000)) // 12s timeout
        ]);

        // If all tests pass, give full score with code quality bonus
        if (executionScore >= 90) { // All or most tests passed
            const qualityBonus = this.getCodeQualityBonus(code, language, problem);
            return Math.min(executionScore + qualityBonus, 100);
        }

    } catch (error) {
        console.log('Execution failed:', error);
    }

    // If execution failed or partial, add basic structure points
    const structureScore = this.getQuickScore(code, language, problem);
    const totalScore = Math.max(executionScore, structureScore);
    
    return Math.min(totalScore, 100);
}

async executeCode(code, language, testCases = []) {
  try {
      console.log('Executing code with test cases:', testCases);
      const response = await axios.post(`${this.executorUrl}/execute`, {
          code,
          language,
          testCases: testCases.slice(0, 3) // Test with up to 3 cases for better accuracy
      }, { timeout: 10000 });

      console.log('Execution response:', response.data);

      if (response.data.success && response.data.testResults) {
          const testResults = response.data.testResults;
          const passed = testResults.filter(t => t.passed).length;
          const total = testResults.length;
          
          console.log(`Tests passed: ${passed}/${total}`);
          
          if (total === 0) return 10; // No tests available

          // Calculate execution score based on test pass rate
          const passPercentage = passed / total;
          
          if (passPercentage === 1.0) {
              return 95; // Perfect score for all tests passed
          } else if (passPercentage >= 0.8) {
              return Math.floor(passPercentage * 85); // 68-85 points
          } else if (passPercentage >= 0.5) {
              return Math.floor(passPercentage * 70); // 35-56 points  
          } else if (passPercentage > 0) {
              return Math.floor(passPercentage * 50); // Some tests passed
          } else {
              return 5; // No tests passed but code compiled
          }
      } else {
          console.log('Execution failed:', response.data.error);
          return 10; // Code had errors but attempted to run
      }
  } catch (error) {
      console.log('Execution timeout or error:', error.message);
      return 5; // Execution failed
  }
}

getCodeQualityBonus(code, language, problem) {
  let bonus = 0;
  
  // Efficiency indicators
  if (code.includes('Map') || code.includes('Set') || code.includes('HashMap')) {
      bonus += 3; // Good data structure usage
  }
  
  // Algorithm complexity awareness
  if (code.includes('sort') && (code.includes('binary') || code.includes('search'))) {
      bonus += 2; // Smart algorithm choice
  }
  
  // Clean code practices
  if (code.split('\n').length > 10 && !code.includes('// Your code here')) {
      bonus += 2; // Substantial implementation
  }
  
  // Problem-specific optimizations
  if (problem.keywords) {
      const advancedKeywords = ['dynamic', 'programming', 'optimization', 'efficient'];
      const matches = problem.keywords.filter(k => 
          advancedKeywords.some(ak => k.toLowerCase().includes(ak))
      ).length;
      bonus += Math.min(matches, 3);
  }
  
  return Math.min(bonus, 5); // Max 5 bonus points
}


getQuickScore(code, language, problem) {
  let score = 0;

  // Reduce points for incomplete looking code
  if (code.includes('// Your code here') || code.includes('# Your code here')) {
      return 8; // Low score for starter template
  }

  const hasFunction = code.includes('function') || code.includes('def ') || code.includes('class');
  const hasReturn = code.includes('return');
  const hasLogic = code.includes('for') || code.includes('while') || code.includes('if');
  
  // Structure points (more generous for complete-looking code)
  if (hasFunction && hasReturn && hasLogic) {
      score += 25; // Good structure
  } else if (hasFunction && hasReturn) {
      score += 15; // Basic structure
  } else if (hasFunction) {
      score += 8; // Minimal structure
  }

  // Problem keyword matching
  if (problem.keywords) {
      const matches = problem.keywords.filter(k => 
          code.toLowerCase().includes(k.toLowerCase())
      ).length;
      score += Math.min(matches * 3, 10); // Up to 10 points for keywords
  }

  // Code complexity indicators
  if (code.length > 100 && !code.includes('// Your code here')) {
      score += 5; // Substantial code
  }

  return Math.min(score, 45); // Cap at 45 for structure-only scoring
}

  detectLanguage(code) {
    if (code.includes('def ') || code.includes('import ')) return 'python';
    if (code.includes('public class') || code.includes('System.out')) return 'java';
    if (code.includes('#include') || code.includes('cout')) return 'cpp';
    return 'javascript';
  }

  async isHealthy() {
    try {
      const res = await axios.get(`${this.executorUrl}/health`, { timeout: 2000 });
      return res.status === 200;
    } catch {
      return false;
    }
  }
}

module.exports = CodeEvaluator;