const http = require('http');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../uploads/catalog/cybertruck/model.glb');
console.log(`Serving: ${filePath}`);
console.log(`Size: ${fs.statSync(filePath).size}`);

const server = http.createServer((req, res) => {
    console.log(`Req: ${req.url}`);
    res.setHeader('Content-Type', 'model/gltf-binary');
    fs.createReadStream(filePath).pipe(res);
});

server.listen(3002, () => {
    console.log('Listening on 3002');
});
