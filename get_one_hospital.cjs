const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/hospital?limit=10',
  method: 'GET',
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
        const parsed = JSON.parse(data);
        if (parsed.data && parsed.data.length > 0) {
            const first = parsed.data.find(h => h.status || h.trLocation || h.natureOfCase || h.fitnessStatus);
            if (first) {
                 console.log(JSON.stringify({
                    _id: first._id,
                    trLocation: first.trLocation,
                    status: first.status,
                    natureOfCase: first.natureOfCase,
                    caseCategory: first.caseCategory,
                    fitnessStatus: first.fitnessStatus,
                    isolationRequired: first.isolationRequired,
                    dischargeSummaryReceived: first.dischargeSummaryReceived
                }, null, 2));
            } else {
                 console.log("No hospital found with populated fields in the first 10 results.");
            }
        } else {
            console.log("Response:", data.substring(0, 500));
        }
    } catch(e) {
        console.log("Raw Response:", data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});
req.end();
