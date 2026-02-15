"use strict";

const CREDENTIALS = "${credentials}";

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  const authorization = headers.authorization;
  if (authorization && authorization[0].value === "Basic " + CREDENTIALS) {
    return request;
  }

  return {
    status: "401",
    statusDescription: "Unauthorized",
    headers: {
      "www-authenticate": [{ key: "WWW-Authenticate", value: 'Basic realm="CRA AI Tools"' }],
      "content-type": [{ key: "Content-Type", value: "text/plain" }],
    },
    body: "Unauthorized",
  };
};
