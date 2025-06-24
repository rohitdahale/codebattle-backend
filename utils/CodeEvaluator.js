// services/DockerCompiler.js
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DockerCompiler {
    constructor() {
        this.tempDir = path.join(__dirname, '../temp');
        this.timeoutMs = 10000; // 10 seconds
        this.memoryLimit = '128m';
        this.cpuLimit = '0.5';
        
        // Ensure temp directory exists
        this.ensureTempDir();
        
        // Pre-built container names for speed
        this.containers = {
            javascript: 'node:18-alpine',
            python: 'python:3.11-alpine',
            java: 'openjdk:17-alpine',
            cpp: 'gcc:latest'
        };
    }

    async ensureTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            console.error('Error creating temp directory:', error);
        }
    }

    generateUniqueId() {
        return crypto.randomBytes(16).toString('hex');
    }

    async executeCode(code, language, testCases = []) {
        const executionId = this.generateUniqueId();
        const workDir = path.join(this.tempDir, executionId);
        
        try {
            // Create execution directory
            await fs.mkdir(workDir, { recursive: true });
            
            // Prepare code file and execution
            const result = await this.runInDocker(code, language, testCases, workDir, executionId);
            
            // Cleanup
            await this.cleanup(workDir);
            
            return result;
        } catch (error) {
            await this.cleanup(workDir);
            throw error;
        }
    }

    async runInDocker(code, language, testCases, workDir, executionId) {
        const containerName = `code-exec-${executionId}`;
        
        try {
            // Prepare files based on language
            const { fileName, dockerCommand } = await this.prepareExecution(code, language, testCases, workDir);
            
            // Docker run command with security restrictions
            const dockerArgs = [
                'run',
                '--rm',
                '--name', containerName,
                '--memory', this.memoryLimit,
                '--cpus', this.cpuLimit,
                '--network', 'none', // No network access
                '--read-only', // Read-only filesystem
                '--tmpfs', '/tmp:noexec,nosuid,size=50m',
                '--user', '1000:1000', // Non-root user
                '--workdir', '/code',
                '-v', `${workDir}:/code:ro`, // Mount as read-only
                '--ulimit', 'nproc=32:32', // Limit processes
                '--ulimit', 'fsize=10485760:10485760', // 10MB file size limit
                this.containers[language],
                'timeout', '10s', // Built-in timeout
                'sh', '-c', dockerCommand
            ];

            const startTime = Date.now();
            const result = await this.runDockerCommand(dockerArgs);
            const executionTime = Date.now() - startTime;

            return {
                success: result.exitCode === 0,
                output: result.stdout,
                error: result.stderr,
                executionTime,
                memoryUsed: await this.getMemoryUsage(containerName),
                testResults: this.parseTestResults(result.stdout, testCases)
            };

        } catch (error) {
            // Ensure container cleanup on error
            await this.forceRemoveContainer(containerName);
            throw error;
        }
    }

    async prepareExecution(code, language, testCases, workDir) {
        switch (language) {
            case 'javascript':
                return this.prepareJavaScript(code, testCases, workDir);
            case 'python':
                return this.preparePython(code, testCases, workDir);
            case 'java':
                return this.prepareJava(code, testCases, workDir);
            case 'cpp':
                return this.prepareCpp(code, testCases, workDir);
            default:
                throw new Error(`Unsupported language: ${language}`);
        }
    }

    async prepareJavaScript(code, testCases, workDir) {
        const fileName = 'solution.js';
        const filePath = path.join(workDir, fileName);
        
        // Wrap code with test execution
        const wrappedCode = `
${code}

// Test execution
const testCases = ${JSON.stringify(testCases)};
const results = [];

testCases.forEach((testCase, index) => {
    try {
        const startTime = process.hrtime.bigint();
        const result = solution(${testCase.input.map(inp => JSON.stringify(inp)).join(', ')});
        const endTime = process.hrtime.bigint();
        const timeTaken = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        const passed = JSON.stringify(result) === JSON.stringify(testCase.expected);
        results.push({
            testCase: index + 1,
            input: testCase.input,
            expected: testCase.expected,
            actual: result,
            passed: passed,
            timeTaken: timeTaken
        });
    } catch (error) {
        results.push({
            testCase: index + 1,
            input: testCase.input,
            expected: testCase.expected,
            actual: null,
            passed: false,
            error: error.message,
            timeTaken: 0
        });
    }
});

console.log('TEST_RESULTS:', JSON.stringify(results));
        `;
        
        await fs.writeFile(filePath, wrappedCode);
        
        return {
            fileName,
            dockerCommand: `node ${fileName}`
        };
    }

    async preparePython(code, testCases, workDir) {
        const fileName = 'solution.py';
        const filePath = path.join(workDir, fileName);
        
        const wrappedCode = `
import json
import time
import sys

${code}

# Test execution
test_cases = ${JSON.stringify(testCases)}
results = []

for i, test_case in enumerate(test_cases):
    try:
        start_time = time.time()
        result = solution(*test_case['input'])
        end_time = time.time()
        time_taken = (end_time - start_time) * 1000  # Convert to milliseconds
        
        passed = result == test_case['expected']
        results.append({
            'testCase': i + 1,
            'input': test_case['input'],
            'expected': test_case['expected'],
            'actual': result,
            'passed': passed,
            'timeTaken': time_taken
        })
    except Exception as error:
        results.append({
            'testCase': i + 1,
            'input': test_case['input'],
            'expected': test_case['expected'],
            'actual': None,
            'passed': False,
            'error': str(error),
            'timeTaken': 0
        })

print('TEST_RESULTS:', json.dumps(results))
        `;
        
        await fs.writeFile(filePath, wrappedCode);
        
        return {
            fileName,
            dockerCommand: `python ${fileName}`
        };
    }

    async prepareJava(code, testCases, workDir) {
        const className = 'Solution';
        const fileName = `${className}.java`;
        const filePath = path.join(workDir, fileName);
        
        const wrappedCode = `
import java.util.*;
import java.util.concurrent.*;

${code}

public class ${className} {
    public static void main(String[] args) {
        // Test execution would go here
        // Implementation similar to JavaScript version
        System.out.println("Java execution completed");
    }
}
        `;
        
        await fs.writeFile(filePath, wrappedCode);
        
        return {
            fileName,
            dockerCommand: `javac ${fileName} && java ${className}`
        };
    }

    async prepareCpp(code, testCases, workDir) {
        const fileName = 'solution.cpp';
        const filePath = path.join(workDir, fileName);
        
        const wrappedCode = `
#include <iostream>
#include <vector>
#include <string>
#include <chrono>
using namespace std;

${code}

int main() {
    // Test execution would go here
    // Implementation similar to other languages
    cout << "C++ execution completed" << endl;
    return 0;
}
        `;
        
        await fs.writeFile(filePath, wrappedCode);
        
        return {
            fileName,
            dockerCommand: `g++ -o solution ${fileName} && ./solution`
        };
    }

    runDockerCommand(args) {
        return new Promise((resolve, reject) => {
            const process = spawn('docker', args);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                resolve({
                    exitCode: code,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                });
            });

            process.on('error', (error) => {
                reject(error);
            });

            // Force kill after timeout
            setTimeout(() => {
                process.kill('SIGKILL');
                reject(new Error('Execution timeout'));
            }, this.timeoutMs);
        });
    }

    parseTestResults(output, testCases) {
        try {
            const match = output.match(/TEST_RESULTS: (.+)/);
            if (match) {
                return JSON.parse(match[1]);
            }
        } catch (error) {
            console.error('Error parsing test results:', error);
        }
        
        // Return default results if parsing fails
        return testCases.map((testCase, index) => ({
            testCase: index + 1,
            input: testCase.input,
            expected: testCase.expected,
            actual: null,
            passed: false,
            error: 'Execution failed',
            timeTaken: 0
        }));
    }

    async getMemoryUsage(containerName) {
        try {
            const result = await this.runDockerCommand([
                'stats', '--no-stream', '--format', 'json', containerName
            ]);
            const stats = JSON.parse(result.stdout);
            return stats.MemUsage;
        } catch (error) {
            return 'Unknown';
        }
    }

    async forceRemoveContainer(containerName) {
        try {
            await this.runDockerCommand(['rm', '-f', containerName]);
        } catch (error) {
            // Ignore errors when force removing
        }
    }

    async cleanup(workDir) {
        try {
            await fs.rm(workDir, { recursive: true, force: true });
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    // Batch execution for multiple test cases (optimization)
    async executeBatch(submissions) {
        const promises = submissions.map(({ code, language, testCases }) => 
            this.executeCode(code, language, testCases)
        );
        
        return Promise.all(promises);
    }
}

module.exports = DockerCompiler;