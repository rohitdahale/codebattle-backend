// Universal Code Executor - No need to write separate code for each problem!
const express = require('express');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const app = express();
app.use(express.json({ limit: '500kb' }));

// Universal data structures and utilities (works for ALL problems)
const UNIVERSAL_SETUP = `
// Data Structures
class ListNode {
    constructor(val, next = null) {
        this.val = val;
        this.next = next;
    }
}

class TreeNode {
    constructor(val, left = null, right = null) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}

// Universal Helper Functions
function parseInput(inputStr, inputTypes) {
    const lines = inputStr.trim().split('\\n');
    const result = [];
    
    for (let i = 0; i < lines.length && i < inputTypes.length; i++) {
        const line = lines[i].trim();
        const type = inputTypes[i];
        
        switch (type) {
            case 'array':
                result.push(JSON.parse(line));
                break;
            case 'number':
                result.push(parseInt(line));
                break;
            case 'string':
                result.push(line.replace(/"/g, ''));
                break;
            case 'linkedlist':
                result.push(arrayToLinkedList(JSON.parse(line)));
                break;
            case 'tree':
                result.push(arrayToTree(JSON.parse(line)));
                break;
            default:
                try {
                    result.push(JSON.parse(line));
                } catch {
                    result.push(line);
                }
        }
    }
    return result;
}

function arrayToLinkedList(arr) {
    if (!arr || arr.length === 0) return null;
    let head = new ListNode(arr[0]);
    let current = head;
    for (let i = 1; i < arr.length; i++) {
        current.next = new ListNode(arr[i]);
        current = current.next;
    }
    return head;
}

function linkedListToArray(head) {
    const result = [];
    while (head) {
        result.push(head.val);
        head = head.next;
    }
    return result;
}

function arrayToTree(arr) {
    if (!arr || arr.length === 0) return null;
    let root = new TreeNode(arr[0]);
    let queue = [root];
    let i = 1;
    
    while (queue.length > 0 && i < arr.length) {
        let node = queue.shift();
        if (i < arr.length && arr[i] !== null) {
            node.left = new TreeNode(arr[i]);
            queue.push(node.left);
        }
        i++;
        if (i < arr.length && arr[i] !== null) {
            node.right = new TreeNode(arr[i]);
            queue.push(node.right);
        }
        i++;
    }
    return root;
}

function treeToArray(root) {
    if (!root) return [];
    const result = [];
    const queue = [root];
    
    while (queue.length > 0) {
        const node = queue.shift();
        if (node) {
            result.push(node.val);
            queue.push(node.left);
            queue.push(node.right);
        } else {
            result.push(null);
        }
    }
    
    // Remove trailing nulls
    while (result.length > 0 && result[result.length - 1] === null) {
        result.pop();
    }
    return result;
}

function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    return false;
}

// Smart function detector and executor
function executeUserFunction(code, inputs, expectedOutput) {
    // Extract function name automatically
    const functionMatch = code.match(/function\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\(/);
    if (!functionMatch) {
        throw new Error('No function found in code');
    }
    
    const functionName = functionMatch[1];
    let result;
    
    // Smart execution based on function name and inputs
    switch (functionName) {
        case 'twoSum':
            result = twoSum(inputs[0], inputs[1]);
            break;
        case 'maxProfit':
            result = maxProfit(inputs[0]);
            break;
        case 'reverseString':
            // This function modifies in place
            const arr = [...inputs[0]]; // Create copy
            reverseString(arr);
            result = arr;
            break;
        case 'isPalindrome':
            result = isPalindrome(inputs[0]);
            break;
        case 'mergeTwoLists':
            result = linkedListToArray(mergeTwoLists(inputs[0], inputs[1]));
            break;
        case 'maxSubArray':
            result = maxSubArray(inputs[0]);
            break;
        case 'climbStairs':
            result = climbStairs(inputs[0]);
            break;
        case 'search':
            result = search(inputs[0], inputs[1]);
            break;
        case 'fizzBuzz':
            result = fizzBuzz(inputs[0]);
            break;
        case 'isValid':
            result = isValid(inputs[0]);
            break;
        default:
            // Generic execution - try to call the function with inputs
            const func = eval(functionName);
            result = func.apply(null, inputs);
    }
    
    return result;
}
`;

// Problem configuration (minimal setup needed)
const PROBLEM_CONFIGS = {
    'two-sum': { inputTypes: ['array', 'number'] },
    'reverse-string': { inputTypes: ['array'] },
    'palindrome-number': { inputTypes: ['number'] },
    'valid-parentheses': { inputTypes: ['string'] },
    'merge-sorted-arrays': { inputTypes: ['linkedlist', 'linkedlist'] },
    'maximum-subarray': { inputTypes: ['array'] },
    'climbing-stairs': { inputTypes: ['number'] },
    'binary-search': { inputTypes: ['array', 'number'] },
    'fizz-buzz': { inputTypes: ['number'] },
    'best-time-to-buy-sell-stock': { inputTypes: ['array'] }
};

app.post('/execute', async (req, res) => {
    const { code, language = 'javascript', testCases = [], problemId } = req.body;
    
    if (language !== 'javascript') {
        return res.status(400).json({ error: 'Only JavaScript supported in this example' });
    }

    const id = Date.now();
    const results = [];
    let compilationError = null;

    try {
        // Get problem config or use smart defaults
        const config = PROBLEM_CONFIGS[problemId] || { inputTypes: ['auto'] };
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            
            // Generate universal test code
            const testCode = `
${UNIVERSAL_SETUP}
${code}

try {
    // Smart input parsing
    const inputTypes = ${JSON.stringify(config.inputTypes)};
    const inputs = parseInput(\`${testCase.input}\`, inputTypes);
    const expectedOutput = ${JSON.stringify(testCase.expectedOutput)};
    
    // Execute user function
    const result = executeUserFunction(\`${code.replace(/`/g, '\\`')}\`, inputs, expectedOutput);
    
    // Smart comparison
    let expected;
    try {
        expected = JSON.parse(expectedOutput);
    } catch {
        expected = expectedOutput;
    }
    
    const passed = deepEqual(result, expected);
    
    console.log(JSON.stringify({
        result: result,
        expected: expected,
        passed: passed,
        inputs: inputs
    }));
    
} catch (error) {
    console.log(JSON.stringify({
        error: error.message,
        passed: false,
        result: null,
        expected: ${JSON.stringify(testCase.expectedOutput)}
    }));
}`;

            const file = `/tmp/solution_${id}_${i}.js`;
            
            try {
                await fs.writeFile(file, testCode);
                const { stdout, stderr } = await execAsync(`timeout 5 node ${file}`, {
                    timeout: 8000,
                    maxBuffer: 1024 * 200
                });

                if (stderr && (stderr.includes('SyntaxError') || stderr.includes('ReferenceError'))) {
                    compilationError = stderr;
                    results.push({
                        passed: false,
                        output: '',
                        expected: testCase.expectedOutput,
                        error: 'Compilation Error',
                        details: stderr
                    });
                } else {
                    try {
                        const testResult = JSON.parse(stdout.trim());
                        results.push({
                            passed: testResult.passed,
                            output: testResult.result,
                            expected: testResult.expected,
                            error: testResult.error || null,
                            inputs: testResult.inputs
                        });
                    } catch (parseError) {
                        results.push({
                            passed: false,
                            output: stdout.trim(),
                            expected: testCase.expectedOutput,
                            error: 'Output parsing error'
                        });
                    }
                }

                // Cleanup
                fs.unlink(file).catch(() => {});
                
            } catch (execError) {
                results.push({
                    passed: false,
                    output: '',
                    expected: testCase.expectedOutput,
                    error: execError.message.includes('timeout') ? 'Time Limit Exceeded' : 'Runtime Error'
                });
            }
        }

        // Calculate LeetCode-style score
        const score = calculateUniversalScore(results, code, compilationError);
        
        res.json({
            success: !compilationError && results.some(r => r.passed),
            testResults: results,
            executionTime: Date.now() - id,
            score: score,
            compilationError: compilationError,
            totalTests: results.length,
            passedTests: results.filter(r => r.passed).length
        });

    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            testResults: [],
            executionTime: 0,
            score: 0
        });
    }
});

function calculateUniversalScore(results, code, compilationError) {
    // Compilation error = 0 points
    if (compilationError) return 0;
    
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    
    // No tests passed = 0 points  
    if (passedTests === 0) return 0;
    
    // All tests passed = 100 points
    if (passedTests === totalTests) return 100;
    
    // Partial credit calculation
    const testScore = Math.floor((passedTests / totalTests) * 80);
    
    // Code quality assessment
    let qualityBonus = 0;
    
    // Has proper function structure
    if (code.includes('function') && code.includes('return')) qualityBonus += 5;
    
    // Not just starter code
    if (!code.includes('// Your code here') && code.length > 50) qualityBonus += 5;
    
    // Good algorithm indicators
    if (code.includes('Map') || code.includes('Set') || code.includes('HashMap')) qualityBonus += 5;
    if (code.includes('while') || code.includes('for')) qualityBonus += 3;
    if (code.includes('if') && code.includes('else')) qualityBonus += 2;
    
    return Math.min(testScore + qualityBonus, 100);
}

app.get('/health', (req, res) => res.json({ 
    status: 'ok', 
    message: 'Universal Code Executor - Handles ALL problems automatically!' 
}));

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log('🚀 Universal Code Executor ready on :3001');
    console.log('✨ No need to write separate code for each problem!');
    console.log('🎯 Automatically handles: Arrays, LinkedLists, Trees, Strings, Numbers');
});

module.exports = app;