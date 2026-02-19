// Simple test for profanity filter
const testWords = ['fuck', 'shit', 'hello', 'world'];

testWords.forEach(word => {
  if (word.includes('fuck') || word.includes('shit')) {
    console.log(`${word} -> ${'*'.repeat(word.length)}`);
  } else {
    console.log(`${word} -> ${word}`);
  }
});

console.log('Basic filter test completed');
