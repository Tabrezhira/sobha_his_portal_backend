const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/hospital',
  method: 'GET',
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
        const parsed = JSON.parse(data);
        console.log("Status:", res.statusCode);
        if (parsed.data && parsed.data.length > 0) {
            const first = parsed.data[0];
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
