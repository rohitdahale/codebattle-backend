const problems = {
    easy: [
      {
        id: 'easy_1',
        title: 'Two Sum',
        description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
        difficulty: 'easy',
        functionName: 'twoSum',
        parameters: [
          { name: 'nums', type: 'number[]' },
          { name: 'target', type: 'number' }
        ],
        returnType: 'number[]',
        examples: [
          {
            input: 'nums = [2,7,11,15], target = 9',
            output: '[0,1]',
            explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].'
          },
          {
            input: 'nums = [3,2,4], target = 6',
            output: '[1,2]'
          }
        ],
        constraints: [
          '2 <= nums.length <= 104',
          '-109 <= nums[i] <= 109',
          '-109 <= target <= 109',
          'Only one valid answer exists.'
        ],
        template: {
          javascript: `function twoSum(nums, target) {
      // Your code here
      
  }`,
          python: `def two_sum(nums, target):
      # Your code here
      pass`,
          java: `public int[] twoSum(int[] nums, int target) {
      // Your code here
      
  }`,
          cpp: `vector<int> twoSum(vector<int>& nums, int target) {
      // Your code here
      
  }`
        },
        testCases: [
          { input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1] },
          { input: { nums: [3, 2, 4], target: 6 }, expected: [1, 2] },
          { input: { nums: [3, 3], target: 6 }, expected: [0, 1] }
        ]
      },
      {
        id: 'easy_2',
        title: 'Palindrome Number',
        description: 'Given an integer x, return true if x is palindrome integer.',
        difficulty: 'easy',
        functionName: 'isPalindrome',
        parameters: [
          { name: 'x', type: 'number' }
        ],
        returnType: 'boolean',
        examples: [
          {
            input: 'x = 121',
            output: 'true',
            explanation: '121 reads as 121 from left to right and from right to left.'
          },
          {
            input: 'x = -121',
            output: 'false',
            explanation: 'From left to right, it reads -121. From right to left, it becomes 121-.'
          }
        ],
        constraints: [
          '-231 <= x <= 231 - 1'
        ],
        template: {
          javascript: `function isPalindrome(x) {
      // Your code here
      
  }`,
          python: `def is_palindrome(x):
      # Your code here
      pass`,
          java: `public boolean isPalindrome(int x) {
      // Your code here
      
  }`,
          cpp: `bool isPalindrome(int x) {
      // Your code here
      
  }`
        },
        testCases: [
          { input: { x: 121 }, expected: true },
          { input: { x: -121 }, expected: false },
          { input: { x: 10 }, expected: false },
          { input: { x: 0 }, expected: true }
        ]
      },
      {
        id: 'easy_3',
        title: 'Valid Parentheses',
        description: 'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.',
        difficulty: 'easy',
        functionName: 'isValid',
        parameters: [
          { name: 's', type: 'string' }
        ],
        returnType: 'boolean',
        examples: [
          {
            input: 's = "()"',
            output: 'true'
          },
          {
            input: 's = "()[]{}"',
            output: 'true'
          },
          {
            input: 's = "(]"',
            output: 'false'
          }
        ],
        constraints: [
          '1 <= s.length <= 104',
          's consists of parentheses only \'()[]{}\''
        ],
        template: {
          javascript: `function isValid(s) {
      // Your code here
      
  }`,
          python: `def is_valid(s):
      # Your code here
      pass`,
          java: `public boolean isValid(String s) {
      // Your code here
      
  }`,
          cpp: `bool isValid(string s) {
      // Your code here
      
  }`
        },
        testCases: [
          { input: { s: "()" }, expected: true },
          { input: { s: "()[]{}" }, expected: true },
          { input: { s: "(]" }, expected: false },
          { input: { s: "([)]" }, expected: false }
        ]
      }
    ],
    
    medium: [
      {
        id: 'medium_1',
        title: 'Add Two Numbers',
        description: 'You are given two non-empty linked lists representing two non-negative integers. The digits are stored in reverse order, and each of their nodes contains a single digit. Add the two numbers and return the sum as a linked list.',
        difficulty: 'medium',
        functionName: 'addTwoNumbers',
        parameters: [
          { name: 'l1', type: 'ListNode' },
          { name: 'l2', type: 'ListNode' }
        ],
        returnType: 'ListNode',
        examples: [
          {
            input: 'l1 = [2,4,3], l2 = [5,6,4]',
            output: '[7,0,8]',
            explanation: '342 + 465 = 807.'
          }
        ],
        constraints: [
          'The number of nodes in each linked list is in the range [1, 100]',
          '0 <= Node.val <= 9',
          'It is guaranteed that the list represents a number that does not have leading zeros'
        ],
        template: {
          javascript: `function addTwoNumbers(l1, l2) {
      // Your code here
      
  }`,
          python: `def add_two_numbers(l1, l2):
      # Your code here
      pass`,
          java: `public ListNode addTwoNumbers(ListNode l1, ListNode l2) {
      // Your code here
      
  }`,
          cpp: `ListNode* addTwoNumbers(ListNode* l1, ListNode* l2) {
      // Your code here
      
  }`
        },
        testCases: [
          { input: { l1: [2, 4, 3], l2: [5, 6, 4] }, expected: [7, 0, 8] },
          { input: { l1: [0], l2: [0] }, expected: [0] },
          { input: { l1: [9, 9, 9, 9, 9, 9, 9], l2: [9, 9, 9, 9] }, expected: [8, 9, 9, 9, 0, 0, 0, 1] }
        ]
      },
      {
        id: 'medium_2',
        title: 'Longest Substring Without Repeating Characters',
        description: 'Given a string s, find the length of the longest substring without repeating characters.',
        difficulty: 'medium',
        functionName: 'lengthOfLongestSubstring',
        parameters: [
          { name: 's', type: 'string' }
        ],
        returnType: 'number',
        examples: [
          {
            input: 's = "abcabcbb"',
            output: '3',
            explanation: 'The answer is "abc", with the length of 3.'
          },
          {
            input: 's = "bbbbb"',
            output: '1',
            explanation: 'The answer is "b", with the length of 1.'
          }
        ],
        constraints: [
          '0 <= s.length <= 5 * 104',
          's consists of English letters, digits, symbols and spaces'
        ],
        template: {
          javascript: `function lengthOfLongestSubstring(s) {
      // Your code here
      
  }`,
          python: `def length_of_longest_substring(s):
      # Your code here
      pass`,
          java: `public int lengthOfLongestSubstring(String s) {
      // Your code here
      
  }`,
          cpp: `int lengthOfLongestSubstring(string s) {
      // Your code here
      
  }`
        },
        testCases: [
          { input: { s: "abcabcbb" }, expected: 3 },
          { input: { s: "bbbbb" }, expected: 1 },
          { input: { s: "pwwkew" }, expected: 3 },
          { input: { s: "" }, expected: 0 }
        ]
      },
      {
        id: 'medium_3',
        title: 'Container With Most Water',
        description: 'You are given an integer array height of length n. There are n vertical lines drawn such that the two endpoints of the ith line are (i, 0) and (i, height[i]). Find two lines that together with the x-axis form a container that contains the most water.',
        difficulty: 'medium',
        functionName: 'maxArea',
        parameters: [
          { name: 'height', type: 'number[]' }
        ],
        returnType: 'number',
        examples: [
          {
            input: 'height = [1,8,6,2,5,4,8,3,7]',
            output: '49',
            explanation: 'The above vertical lines are represented by array [1,8,6,2,5,4,8,3,7]. The max area of water the container can contain is 49.'
          }
        ],
        constraints: [
          'n == height.length',
          '2 <= n <= 105',
          '0 <= height[i] <= 104'
        ],
        template: {
          javascript: `function maxArea(height) {
      // Your code here
      
  }`,
          python: `def max_area(height):
      # Your code here
      pass`,
          java: `public int maxArea(int[] height) {
      // Your code here
      
  }`,
          cpp: `int maxArea(vector<int>& height) {
      // Your code here
      
  }`
        },
        testCases: [
          { input: { height: [1, 8, 6, 2, 5, 4, 8, 3, 7] }, expected: 49 },
          { input: { height: [1, 1] }, expected: 1 },
          { input: { height: [4, 3, 2, 1, 4] }, expected: 16 }
        ]
      }
    ],
    
    hard: [
      {
        id: 'hard_1',
        title: 'Median of Two Sorted Arrays',
        description: 'Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.',
        difficulty: 'hard',
        functionName: 'findMedianSortedArrays',
        parameters: [
          { name: 'nums1', type: 'number[]' },
          { name: 'nums2', type: 'number[]' }
        ],
        returnType: 'number',
        examples: [
          {
            input: 'nums1 = [1,3], nums2 = [2]',
            output: '2.00000',
            explanation: 'merged array = [1,2,3] and median is 2.'
          },
          {
            input: 'nums1 = [1,2], nums2 = [3,4]',
            output: '2.50000',
            explanation: 'merged array = [1,2,3,4] and median is (2 + 3) / 2 = 2.5.'
          }
        ],
        constraints: [
          'nums1.length == m',
          'nums2.length == n',
          '0 <= m <= 1000',
          '0 <= n <= 1000',
          '1 <= m + n <= 2000',
          '-106 <= nums1[i], nums2[i] <= 106'
        ],
        template: {
          javascript: `function findMedianSortedArrays(nums1, nums2) {
      // Your code here
      
  }`,
          python: `def find_median_sorted_arrays(nums1, nums2):
      # Your code here
      pass`,
          java: `public double findMedianSortedArrays(int[] nums1, int[] nums2) {
      // Your code here
      
  }`,
          cpp: `double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
      // Your code here
      
  }`
        },
        testCases: [
          { input: { nums1: [1, 3], nums2: [2] }, expected: 2.0 },
          { input: { nums1: [1, 2], nums2: [3, 4] }, expected: 2.5 },
          { input: { nums1: [0, 0], nums2: [0, 0] }, expected: 0.0 }
        ]
      },
      {
        id: 'hard_2',
        title: 'Regular Expression Matching',
        description: 'Given an input string s and a pattern p, implement regular expression matching with support for \'.\' and \'*\' where: \'.\' Matches any single character. \'*\' Matches zero or more of the preceding element.',
        difficulty: 'hard',
        functionName: 'isMatch',
        parameters: [
          { name: 's', type: 'string' },
          { name: 'p', type: 'string' }
        ],
        returnType: 'boolean',
        examples: [
          {
            input: 's = "aa", p = "a"',
            output: 'false',
            explanation: '"a" does not match the entire string "aa".'
          },
          {
            input: 's = "aa", p = "a*"',
            output: 'true',
            explanation: '\'*\' means zero or more of the preceding element, \'a\'. Therefore, by repeating \'a\' once, it becomes "aa".'
          }
        ],
        constraints: [
          '1 <= s.length <= 20',
          '1 <= p.length <= 30',
          's contains only lowercase English letters',
          'p contains only lowercase English letters, \'.\', and \'*\''
        ],
        template: {
          javascript: `function isMatch(s, p) {
      // Your code here
      
  }`,
          python: `def is_match(s, p):
      # Your code here
      pass`,
          java: `public boolean isMatch(String s, String p) {
      // Your code here
      
  }`,
          cpp: `bool isMatch(string s, string p) {
      // Your code here
      
  }`
        },
        testCases: [
          { input: { s: "aa", p: "a" }, expected: false },
          { input: { s: "aa", p: "a*" }, expected: true },
          { input: { s: "ab", p: ".*" }, expected: true },
          { input: { s: "aab", p: "c*a*b" }, expected: true }
        ]
      },
      {
        id: 'hard_3',
        title: 'N-Queens',
        description: 'The n-queens puzzle is the problem of placing n queens on an n×n chessboard such that no two queens attack each other. Given an integer n, return all distinct solutions to the n-queens puzzle.',
        difficulty: 'hard',
        functionName: 'solveNQueens',
        parameters: [
          { name: 'n', type: 'number' }
        ],
        returnType: 'string[][]',
        examples: [
          {
            input: 'n = 4',
            output: '[[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]]',
            explanation: 'There exist two distinct solutions to the 4-queens puzzle.'
          }
        ],
        constraints: [
          '1 <= n <= 9'
        ],
        template: {
          javascript: `function solveNQueens(n) {
      // Your code here
      
  }`,
          python: `def solve_n_queens(n):
      # Your code here
      pass`,
          java: `public List<List<String>> solveNQueens(int n) {
      // Your code here
      
  }`,
          cpp: `vector<vector<string>> solveNQueens(int n) {
      // Your code here
      
  }`
        },
        testCases: [
          { input: { n: 4 }, expected: [[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]] },
          { input: { n: 1 }, expected: [["Q"]] }
        ]
      }
    ]
  };
  
  /**
   * Get a random problem based on difficulty level
   * @param {string} difficulty - 'easy', 'medium', or 'hard'
   * @returns {Object|null} Random problem object or null if difficulty not found
   */
  const getRandomProblem = async (difficulty = 'medium') => {
    try {
      const difficultyProblems = problems[difficulty.toLowerCase()];
      
      if (!difficultyProblems || difficultyProblems.length === 0) {
        console.error(`No problems found for difficulty: ${difficulty}`);
        return null;
      }
      
      const randomIndex = Math.floor(Math.random() * difficultyProblems.length);
      const selectedProblem = difficultyProblems[randomIndex];
      
      // Add a unique instance ID to track this specific problem instance
      return {
        ...selectedProblem,
        instanceId: `${selectedProblem.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    } catch (error) {
      console.error('Error getting random problem:', error);
      return null;
    }
  };
  
  /**
   * Get all problems for a specific difficulty
   * @param {string} difficulty - 'easy', 'medium', or 'hard'
   * @returns {Array} Array of problems or empty array
   */
  const getProblemsByDifficulty = (difficulty) => {
    return problems[difficulty.toLowerCase()] || [];
  };
  
  /**
   * Get a specific problem by ID
   * @param {string} problemId - The problem ID
   * @returns {Object|null} Problem object or null if not found
   */
  const getProblemById = (problemId) => {
    for (const difficulty in problems) {
      const problem = problems[difficulty].find(p => p.id === problemId);
      if (problem) {
        return problem;
      }
    }
    return null;
  };
  
  /**
   * Get all available difficulties
   * @returns {Array} Array of difficulty strings
   */
  const getAvailableDifficulties = () => {
    return Object.keys(problems);
  };
  
  /**
   * Get problem statistics
   * @returns {Object} Statistics about problems
   */
  const getProblemStats = () => {
    const stats = {
      total: 0,
      byDifficulty: {}
    };
    
    for (const difficulty in problems) {
      const count = problems[difficulty].length;
      stats.byDifficulty[difficulty] = count;
      stats.total += count;
    }
    
    return stats;
  };
  
  /**
   * Validate problem structure
   * @param {Object} problem - Problem object to validate
   * @returns {boolean} True if valid, false otherwise
   */
  const validateProblem = (problem) => {
    const requiredFields = [
      'id', 'title', 'description', 'difficulty', 'functionName',
      'parameters', 'returnType', 'examples', 'constraints', 'template', 'testCases'
    ];
    
    return requiredFields.every(field => problem.hasOwnProperty(field));
  };
  
  module.exports = {
    getRandomProblem,
    getProblemsByDifficulty,
    getProblemById,
    getAvailableDifficulties,
    getProblemStats,
    validateProblem,
    problems // Export the problems object for direct access if needed
  };