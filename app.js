const express = require("express");
const axios = require("axios");

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
      code: 500,
      message: e.message
    }
    return res.status(200).end(JSON.stringify(resp));
  }
});

app.get("/hit_other_service", (req, res) => {
  try {
    const options = {
      method: 'POST',
      url: 'https://andruxnet-random-famous-quotes.p.rapidapi.com/',
      params: {cat: 'movies', count: '10'},
      headers: {
        'X-RapidAPI-Key': 'SIGN-UP-FOR-KEY',
        'X-RapidAPI-Host': 'andruxnet-random-famous-quotes.p.rapidapi.com'
      }
    };

    axios.request(options).then(function (response) {
      res.status(200).end(JSON.stringify(response.data));
    }).catch(function (error) {
      res.status(200).json(JSON.stringify(error.response.data));
    });
  } catch (e) {
    let resp = {
      code: 500,
      message: e.message
    }
    return res.status(200).end(JSON.stringify(resp));
  }
})

app.get("/service_a", (req, res) => {
  try {
    const options = {
      method: 'POST',
      url: `localhost:${PORT}/service_b`,
      headers: {
        'apllication/type': 'x-www-form-urlencoded',
      }
    };

    axios.request(options).then(function (response) {
      res.status(200).end(JSON.stringify(response.data));
    }).catch(function (error) {
      res.status(200).json(JSON.parse(JSON.stringify(error.config)));
    });
  } catch (e) {
    let resp = {
      code: 500,
      message: e.message
    }
    return res.status(200).end(JSON.stringify(resp));
  }
})

app.post("/service_b", (req, res) => {
  try {
    const options = {
      method: 'POST',
      url: `localhost:${PORT}/service_c`,
      headers: {
        'apllication/type': 'x-www-form-urlencoded',
      }
    };

    axios.request(options).then(function (response) {
      res.status(200).end(JSON.stringify(response.data));
    }).catch(function (error) {
      res.status(200).json(JSON.parse(JSON.stringify(error.config)));
    });
  } catch (e) {
    let resp = {
      code: 500,
      message: e.message
    }
    return res.status(200).end(JSON.stringify(resp));
  }
})

app.post("/service_c", (req, res) => {
  try {
    const resp = {
      code: 200,
      message: 'finish at service_c'
    }
    res.status(200).end(JSON.stringify(resp));
  } catch (e) {
    let resp = {
      code: 500,
      message: e.message
    }
    return res.status(200).end(JSON.stringify(resp));
  }
})

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
// for (let i=0; i<9000; i++) {
  
// }
