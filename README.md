# Tell - Easy and Secure Communication

## Documentation

### Used libraries

* BinaryJS
https://github.com/binaryjs/binaryjs/tree/master/doc

* OpenPGP.js
http://openpgpjs.org/openpgpjs/doc/

### BinaryJS communication protocol for Tell

* Client to Client

| meta action | meta value | file |
| ----------- | ---------- | ---- |
| file        | -          | data |
| pubKey      | -          | key  |

* Server to Client

| meta action | meta value | file |
| ----------- | ---------- | ---- |
| id          | id         | -    |
| matched     | true/false | -    |
| online      | true/false | -    |

* Client to Server

| meta action | meta value | file |
| ----------- | ---------- | ---- |
| start       | -          | -    | 
| join        | id         | -    |
