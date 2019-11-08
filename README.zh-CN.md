# 简介

一个基于redis的自动代理切换服务，方便分布式应用的多副本兼容。

后续将加入Linux转发端自动部署转发服务，和基于阿里云ECS的自动扩容。

[English](https://github.com/test3207/apax-core/blob/master/README.md)

## 准备

一个可用的redis服务。

数个拥有root权限的Linux转发服务器。

## 安装

```bash
npm install apax-core --save
```

支持 Node.js 8.x 及以上版本。

## 样例

```javascript
const ApaxCore = require('apax-core')
const apaxCore = new ApaxCore({
  ips: ['192.168.0.1', '192.168.0.2'], // 已部署转发服务的Linux地址
  redis: 'redis://127.0.0.1:6379', // redis服务
  serial: 30, // 重启服务器连续性阈值（分钟），在此阈值内服务能重启的话，就复用现有的数据
  expire: 30 // 失效IP可重试时间，失效后除非触发IP池补偿机制，重试时间内该IP不会被分配出去
})

(async () => {
  const ip = await apaxCore.getProxy('https://example.com') // 获取代理服务器的IP
  try {
    await someRequests(ip) // 客户端拿到ip发起访问请求
  } catch (e) {
    await apaxCore.fail('https://example.com', '192.168.0.1') // 如果访问出现问题，后续一段时间不再分配这个代理
  }
})()

```
