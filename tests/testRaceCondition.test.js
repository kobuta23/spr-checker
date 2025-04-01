const axios = require('axios');

// Configure your API details
const API_URL = 'http://localhost:9999/eligibility?addresses=0x8A396863cD7726B18ebE34651D32B256d6c6De80'; // Replace with your endpoint

const NUM_REQUESTS = 10;

async function testRaceCondition() {
  console.log(`Sending ${NUM_REQUESTS} parallel GET requests to ${API_URL}`);
  
  // Remove type annotation
  let requests = [];
  
  for (let i = 0; i < NUM_REQUESTS; i++) {
    requests.push(
      axios.get(API_URL)
        .then(response => {
          console.log(`Request ${i+1} succeeded:`, response.status);
          return { index: i, success: true, status: response.status };
        })
        .catch(error => {
          console.error(`Request ${i+1} failed:`, error.message);
          return { index: i, success: false, error: error.message };
        })
    );
  }
  
  const results = await Promise.all(requests);
  console.log(`\nResults: ${results.filter(r => r.success).length} succeeded`);
}

// Run the test
testRaceCondition().catch(err => {
  console.error("Test failed:", err);
});
