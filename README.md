# Tell 

## Documentation

### Used libraries
* BinaryJS
https://github.com/binaryjs/binaryjs/tree/master/doc

* OpenPGP.js
http://openpgpjs.org/openpgpjs/doc/

### BinaryJS communication API for Tell
* Client to Client

| meta action | meta value | file | description |
| ----------- | ---------- | ---- |
| file        | -          | data |
| pubKey      | -          | key  |

* Server to Client

| meta action | meta value | file |
| ----------- | ---------- | ---- |
| id          | id         | -    |
| status      | true/false | -    |

* Client to Server

| meta action | meta value | file |
| ----------- | ---------- | ---- |
| start       | -          | -    | 
| join        | id         | -    |
