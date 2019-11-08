const Instance = require('./lib/instance')
const redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(redis)

const checkInit = Symbol('checkInit')

module.exports = class {
  constructor (options) {
    const optionObj = (typeof options === 'object') ? options : {}
    if (!optionObj.ips || !optionObj.ips.length) throw new Error('ips are required!')
    optionObj.redis = optionObj.redis || 'redis://127.0.0.1:6379'
    optionObj.serial = optionObj.serial || 30
    optionObj.expire = optionObj.expire || 30
    const client = redis.createClient(optionObj.redis)
    optionObj.client = client
    this.options = optionObj
    this.instances = {}
  }

  async [checkInit] (url) {
    let host = url
    try {
      const urlObj = new URL(url)
      host = urlObj.host
    } catch (e) {}
    if (!this.instances[host]) {
      const newInstance = new Instance(host)
      await newInstance.init(this.options)
      this.instances[host] = newInstance
    }
    return this.instances[host]
  }

  async getProxy (url) {
    const instance = await this[checkInit](url)
    const ip = await instance.getProxy()
    return ip
  }

  async fail (url, ip) {
    const instance = await this[checkInit](url)
    await instance.fail(ip)
  }
}
