const moment = require('moment')
const redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(redis)
const schedule = require('node-schedule')

const checkExist = Symbol('checkExist')
const createTimer = Symbol('createTimer')
const inited = Symbol('inited')

module.exports = class {
  constructor (host) {
    this.host = host
  }

  async init (options) {
    if (this[inited]) return
    this[inited] = true

    this.options = options

    const exist = await this[checkExist]()
    if (!exist) {
      const client = this.options.client
      const initLock = await client.setAsync(`${this.host}:initLock`, 1, 'EX', 10, 'NX')
      if (initLock) {
        await client.delAsync(`${this.host}:count`)
        await client.delAsync(`${this.host}:fail`)
  
        const argsCount = [`${this.host}:count`]
        const argsFail = [`${this.host}:fail`]
        this.options.ips.forEach((ip) => {
          argsCount.push(0, ip)
          argsFail.push(0, ip)
        })
        await client.zaddAsync(argsCount)
        await client.zaddAsync(argsFail)
      }
    }

    await this[createTimer]()
  }

  async [checkExist] () {
    const client = this.options.client
    const countTime = await client.getAsync(`${this.host}:countTime`)
    if (!countTime || !moment(Number(countTime)).isValid()) return false
    const serial = this.options.serial || 30
    if (moment(Number(countTime)).isBefore(moment().subtract(serial, 'minute'))) return false

    const countType = await client.typeAsync(`${this.host}:count`)
    if (countType !== 'zset') return false

    const failType = await client.typeAsync(`${this.host}:fail`)
    if (failType !== 'zset') return false

    return true
  }

  async [createTimer] () {
    const client = this.options.client
    schedule.scheduleJob('0 */1 * * * *', async () => {
      const timerLock = await client.setAsync(`${this.host}:countLock`, 1, 'EX', 3, 'NX')
      if (!timerLock) return
      const args = [`${this.host}:count`]
      this.options.ips.forEach((ip) => {
        args.push(0, ip)
      })
      await client.zaddAsync(args)
      await client.setAsync(`${this.host}:countTime`, Number(moment().toDate()))
    })
  }

  async getProxy () {
    const client = this.options.client
    const expire = this.options.expire || 30
    const expireTime = Number(moment().subtract(expire, 'minutes').toDate())

    let getLock
    // let raceTime = Number(moment().toDate()) // 不显著，先砍了
    while (!getLock) {
      getLock = await client.setAsync(`${this.host}:getLock`, 1, 'EX', 10, 'NX')
      // await new Promise((resolve, reject) => {
      //   setTimeout(() => {
      //     resolve()
      //   }, Math.min(raceTime + 100 * Math.random() - Number(moment().toDate()), 0))
      // })
    }

    const useList = await client.zrangebyscoreAsync(`${this.host}:fail`, 0, expireTime)
    if (!useList.length) {
      const freeIp = await client.zrangeAsync(`${this.host}:fail`, 0, 0)
      const freeLock = await client.setAsync(`${this.host}:freeLock`, 1, 'PX', 10, 'NX')
      if (freeLock) {
        await client.zaddAsync(`${this.host}:fail`, expireTime, freeIp)
      }
      client.zincrbyAsync(`${this.host}:count`, 1, freeIp)
      await client.delAsync(`${this.host}:getLock`)
      return freeIp
    }

    const countList = await client.zrangeAsync(`${this.host}:count`, 0, -1)
    for (const countIp of countList) {
      if (useList.includes(countIp)) {
        await client.zincrbyAsync(`${this.host}:count`, 1, countIp)
        await client.delAsync(`${this.host}:getLock`)
        return countIp
      }
    }
  }

  async fail (ip) {
    const client = this.options.client
    const args = [`${this.host}:fail`, Number(moment().toDate()), ip]
    await client.zaddAsync(args)
  }

}
