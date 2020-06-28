function reactive(target) {
  const observed = new Proxy(target, {
    get(target, key) {
      console.log(key)
      const res =  Reflect.get(target, key)
      return typeof res === 'object' ? reactive(res) : res
    },
    set(target, key, value) {
      console.log(value)
      const res =  Reflect.set(target, key, value)
      return res
    }
  })
  return observed
}

const obj1 = {
  a: 'a',
  b: {
    title: 'tom'
  }
}
const obj2 = reactive(obj1)
obj2.b.title = 'rrr'
console.log(obj2)

