const express = require("express");

const PORT = parseInt(process.env.PORT || "8080");
const app = express();

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("/for", (req, res) => {
  try {
    for (let i=0; i<1000; i++) {

    }
    let resp = {
      code: 200,
      message: 'for 1000x'
    }
    // res.status(200).end(JSON.stringify(resp));
    return res.status(200).end(resp);
  } catch (e) {
    let resp = {
      code: 200,
      message: e.message
    }
    return res.status(200).end(JSON.stringify(resp));
  }
});

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
// for (let i=0; i<9000; i++) {
  
// }
