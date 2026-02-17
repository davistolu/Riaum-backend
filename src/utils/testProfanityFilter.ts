import { censorProfanity, containsProfanity, moderateContent } from './profanityFilter';

// Test function to verify profanity filtering
export function testProfanityFilter() {
  console.log('Testing Profanity Filter...\n');

  const testCases = [
    {
      input: 'Hello, how are you today?',
      expected: 'Hello, how are you today?',
      description: 'Clean message should remain unchanged'
    },
    {
      input: 'This is fucking awesome!',
      expected: 'This is ******** awesome!',
      description: 'Profanity should be censored'
    },
    {
      input: 'What the hell is this shit?',
      expected: 'What the **** is this ****?',
      description: 'Multiple profanities should be censored'
    },
    {
      input: 'You are a fcking idiot',
      expected: 'You are a ******* idiot',
      description: 'Leet speak should be caught'
    },
    {
      input: 'A$$ hole and b1tch',
      expected: '*** **** and *****',
      description: 'Character substitutions should be caught'
    },
    {
      input: 'Don\'t be a jerk',
      expected: 'Don\'t be a ****',
      description: 'Mild profanity should be censored'
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  testCases.forEach((testCase, index) => {
    const result = censorProfanity(testCase.input);
    const passed = result === testCase.expected;
    
    console.log(`Test ${index + 1}: ${testCase.description}`);
    console.log(`Input:    "${testCase.input}"`);
    console.log(`Expected: "${testCase.expected}"`);
    console.log(`Result:   "${result}"`);
    console.log(`Status:   ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('---');
    
    if (passed) passedTests++;
  });

  // Test containsProfanity function
  console.log('\nTesting containsProfanity function:');
  const profanityTests = [
    { input: 'This is clean', expected: false },
    { input: 'This is fucking dirty', expected: true },
    { input: 'What the hell', expected: true }
  ];

  profanityTests.forEach((test, index) => {
    const result = containsProfanity(test.input);
    const passed = result === test.expected;
    
    console.log(`Profanity Test ${index + 1}:`);
    console.log(`Input:    "${test.input}"`);
    console.log(`Expected: ${test.expected}`);
    console.log(`Result:   ${result}`);
    console.log(`Status:   ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('---');
    
    if (passed) passedTests++;
    totalTests++;
  });

  // Test moderateContent function
  console.log('\nTesting moderateContent function:');
  const moderationTest = moderateContent('This is fucking awesome!');
  console.log('Moderation Test:');
  console.log(`Input:           "This is fucking awesome!"`);
  console.log(`Censored:        "${moderationTest.censoredContent}"`);
  console.log(`Was Censored:    ${moderationTest.wasCensored}`);
  console.log(`Has Profanity:   ${moderationTest.hasProfanity}`);
  console.log(`Original:        "${moderationTest.originalContent}"`);
  console.log('---');

  if (moderationTest.wasCensored && moderationTest.hasProfanity) {
    passedTests++;
    totalTests++;
    console.log('Moderation Test: ✅ PASS');
  } else {
    console.log('Moderation Test: ❌ FAIL');
  }

  console.log(`\nTest Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Profanity filter is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the profanity filter implementation.');
  }

  return passedTests === totalTests;
}

// Run tests if this file is executed directly
if (require.main === module) {
  testProfanityFilter();
}

export default testProfanityFilter;
