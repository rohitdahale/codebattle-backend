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
    
    // Remove the JavaScript-only restriction
    const supportedLanguages = ['javascript', 'python', 'java', 'cpp'];
    if (!supportedLanguages.includes(language)) {
        return res.status(400).json({ 
            error: `Language ${language} not supported. Supported: ${supportedLanguages.join(', ')}` 
        });
    }

    const id = Date.now();
    const results = [];
    let compilationError = null;

    try {
        const config = PROBLEM_CONFIGS[problemId] || { inputTypes: ['auto'] };
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            
            // Generate language-specific test code
            const { testCode, fileName, compileCmd, runCmd } = generateLanguageSpecificCode(
                code, testCase, config, language, id, i
            );

            const filePath = `/tmp/${fileName}`;
            
            try {
                await fs.writeFile(filePath, testCode);
                
                // Compile if needed (C++/Java)
                if (compileCmd) {
                    const compileResult = await execAsync(compileCmd, {
                        timeout: 10000,
                        cwd: '/tmp'
                    });
                    
                    if (compileResult.stderr && (compileResult.stderr.includes('error') || compileResult.stderr.includes('Error'))) {
                        compilationError = compileResult.stderr;
                        results.push({
                            passed: false,
                            output: '',
                            expected: testCase.expectedOutput,
                            error: 'Compilation Error',
                            details: compileResult.stderr
                        });
                        continue;
                    }
                }

                // Execute the code
                const { stdout, stderr } = await execAsync(runCmd, {
                    timeout: 8000,
                    maxBuffer: 1024 * 200,
                    cwd: '/tmp'
                });

                // Parse results (same logic as before)
                if (stderr && (stderr.includes('Error') || stderr.includes('Exception'))) {
                    results.push({
                        passed: false,
                        output: stderr,
                        expected: testCase.expectedOutput,
                        error: 'Runtime Error'
                    });
                } else {
                    try {
                        const testResult = JSON.parse(stdout.trim());
                        results.push({
                            passed: testResult.passed,
                            output: testResult.result,
                            expected: testResult.expected,
                            error: testResult.error || null
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

                // Cleanup files
                fs.unlink(filePath).catch(() => {});
                if (language === 'java') {
                    fs.unlink(`/tmp/Solution_${id}_${i}.class`).catch(() => {});
                } else if (language === 'cpp') {
                    fs.unlink(`/tmp/solution_${id}_${i}`).catch(() => {});
                }
                
            } catch (execError) {
                results.push({
                    passed: false,
                    output: '',
                    expected: testCase.expectedOutput,
                    error: execError.message.includes('timeout') ? 'Time Limit Exceeded' : 'Runtime Error'
                });
            }
        }

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


function generateLanguageSpecificCode(userCode, testCase, config, language, id, testIndex) {
    const inputTypes = config.inputTypes;
    
    switch (language) {
        case 'javascript':
            return {
                testCode: generateJavaScriptCode(userCode, testCase, inputTypes),
                fileName: `solution_${id}_${testIndex}.js`,
                compileCmd: null,
                runCmd: `timeout 5 node solution_${id}_${testIndex}.js`
            };
            
        case 'python':
            return {
                testCode: generatePythonCode(userCode, testCase, inputTypes),
                fileName: `solution_${id}_${testIndex}.py`,
                compileCmd: null,
                runCmd: `timeout 5 python3 solution_${id}_${testIndex}.py`
            };
            
        case 'java':
            return {
                testCode: generateJavaCode(userCode, testCase, inputTypes, id, testIndex),
                fileName: `Solution_${id}_${testIndex}.java`,
                compileCmd: `javac Solution_${id}_${testIndex}.java`,
                runCmd: `timeout 5 java Solution_${id}_${testIndex}`
            };
            
        case 'cpp':
            return {
                testCode: generateCppCode(userCode, testCase, inputTypes),
                fileName: `solution_${id}_${testIndex}.cpp`,
                compileCmd: `g++ -o solution_${id}_${testIndex} solution_${id}_${testIndex}.cpp`,
                runCmd: `timeout 5 ./solution_${id}_${testIndex}`
            };
    }
}

function generateJavaScriptCode(userCode, testCase, inputTypes) {
    return `
${UNIVERSAL_SETUP}
${userCode}

try {
    const inputTypes = ${JSON.stringify(inputTypes)};
    const inputs = parseInput(\`${testCase.input}\`, inputTypes);
    const expectedOutput = ${JSON.stringify(testCase.expectedOutput)};
    
    const result = executeUserFunction(\`${userCode.replace(/`/g, '\\`')}\`, inputs, expectedOutput);
    
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
        passed: passed
    }));
    
} catch (error) {
    console.log(JSON.stringify({
        error: error.message,
        passed: false,
        result: null,
        expected: ${JSON.stringify(testCase.expectedOutput)}
    }));
}`;
}

function generatePythonCode(userCode, testCase, inputTypes) {
    return `
import json
import sys

${userCode}

def parse_input(input_str, input_types):
    lines = input_str.strip().split('\\n')
    result = []
    
    for i in range(min(len(lines), len(input_types))):
        line = lines[i].strip()
        input_type = input_types[i]
        
        if input_type == 'array':
            result.append(json.loads(line))
        elif input_type == 'number':
            result.append(int(line))
        elif input_type == 'string':
            result.append(line.replace('"', ''))
        else:
            try:
                result.append(json.loads(line))
            except:
                result.append(line)
    
    return result

try:
    input_types = ${JSON.stringify(inputTypes)}
    inputs = parse_input("""${testCase.input}""", input_types)
    expected_output = """${testCase.expectedOutput}"""
    
    # Find and call the main function
    func_names = [name for name in globals() if callable(globals()[name]) and not name.startswith('_')]
    if func_names:
        main_func = globals()[func_names[0]]
        result = main_func(*inputs)
    else:
        raise Exception("No function found")
    
    try:
        expected = json.loads(expected_output)
    except:
        expected = expected_output
    
    passed = result == expected
    
    print(json.dumps({
        "result": result,
        "expected": expected,
        "passed": passed
    }))
    
except Exception as error:
    print(json.dumps({
        "error": str(error),
        "passed": False,
        "result": None,
        "expected": """${testCase.expectedOutput}"""
    }))
`;
}

function generateJavaCode(userCode, testCase, inputTypes, id, testIndex) {
    return `
import java.util.*;
import com.google.gson.*;

public class Solution_${id}_${testIndex} {
    ${userCode}
    
    public static void main(String[] args) {
        try {
            Gson gson = new Gson();
            String[] inputTypes = ${JSON.stringify(inputTypes)};
            String input = """${testCase.input}""";
            String expectedOutput = """${testCase.expectedOutput}""";
            
            String[] lines = input.trim().split("\\n");
            Object[] inputs = new Object[Math.min(lines.length, inputTypes.length)];
            
            for (int i = 0; i < inputs.length; i++) {
                String line = lines[i].trim();
                String type = inputTypes[i];
                
                switch (type) {
                    case "array":
                        inputs[i] = gson.fromJson(line, int[].class);
                        break;
                    case "number":
                        inputs[i] = Integer.parseInt(line);
                        break;
                    case "string":
                        inputs[i] = line.replace("\\"", "");
                        break;
                    default:
                        inputs[i] = gson.fromJson(line, Object.class);
                }
            }
            
            Solution_${id}_${testIndex} solution = new Solution_${id}_${testIndex}();
            Object result = callSolutionMethod(solution, inputs);
            
            Object expected;
            try {
                expected = gson.fromJson(expectedOutput, Object.class);
            } catch (Exception e) {
                expected = expectedOutput;
            }
            
            boolean passed = Objects.deepEquals(result, expected);
            
            Map<String, Object> output = new HashMap<>();
            output.put("result", result);
            output.put("expected", expected);
            output.put("passed", passed);
            
            System.out.println(gson.toJson(output));
            
        } catch (Exception error) {
            Map<String, Object> output = new HashMap<>();
            output.put("error", error.getMessage());
            output.put("passed", false);
            output.put("result", null);
            output.put("expected", """${testCase.expectedOutput}""");
            
            Gson gson = new Gson();
            System.out.println(gson.toJson(output));
        }
    }
    
    private static Object callSolutionMethod(Solution_${id}_${testIndex} solution, Object[] inputs) {
        // Add reflection logic to call the first public method that's not main
        return null; // Simplified for now
    }
}
`;
}

function generateCppCode(userCode, testCase, inputTypes) {
    return `
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <nlohmann/json.hpp>

using json = nlohmann::json;
using namespace std;

${userCode}

int main() {
    try {
        string input = R"(${testCase.input})";
        string expectedOutput = R"(${testCase.expectedOutput})";
        
        // Parse input (simplified)
        istringstream iss(input);
        string line;
        vector<string> lines;
        while (getline(iss, line)) {
            lines.push_back(line);
        }
        
        // Call solution function (this needs to be adapted per problem)
        // For now, just return a placeholder
        
        json result;
        result["result"] = nullptr;
        result["expected"] = json::parse(expectedOutput);
        result["passed"] = false;
        
        cout << result.dump() << endl;
        
    } catch (const exception& error) {
        json result;
        result["error"] = error.what();
        result["passed"] = false;
        result["result"] = nullptr;
        result["expected"] = R"(${testCase.expectedOutput})";
        
        cout << result.dump() << endl;
    }
    
    return 0;
}
`;
}


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