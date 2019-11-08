# Introduction

An auto proxy agent based on redis, in order to solve multi replicas problem.

Deploying proxy service on Linux servers and extention automatically based on Aliyun ECS are on the todo list.

[简体中文](https://github.com/test3207/apax-core/blob/master/README.zh-CN.md)

## Preparation

An available redis server is needed.

Several linux servers with root authority is needed.

## Installation

```bash
npm install apax-core --save
```

Node.js >= 8.0.0 required.

## Example

```javascript
const ApaxCore = require('apax-core')
const apaxCore = new ApaxCore({
  ips: ['192.168.0.1', '192.168.0.2'], // IPs with proxy service on the servers
  redis: 'redis://127.0.0.1:6379', // redis service
  serial: 30, // Serial duration, reuse the data if the apps restart in the duration
  expire: 30 // Expire duration of invalid ip, the ip won't be issued by getProxy in the duration if failed once
})

(async () => {
  const ip = await apaxCore.getProxy('https://example.com') // get an available ip
  try {
    await someRequests(ip) // do some requests
  } catch (e) {
    await apaxCore.fail('https://example.com', '192.168.0.1') // if a ip is blocked, call apaxCore.fail to shield it
  }
})()

```
