// 用来保存已代理的数据映射
let toProxy = new WeakMap()
// 用来保存已代理的反向数据映射
let toRow = new WeakMap()
// 存储effect的栈
let effectStack = []
// 缓存effect
// targetMap数据格式如下
// {
//   target:{
//     age: [effect, effect]  (set),
//     name:[effect, effect] (set)
//   }
// }
let targetMap = new WeakMap()

// 对普通对象设置代理的handler
const baseHandler = {
  get(target, key) {
    const res = Reflect.get(target, key)
    track(target, key)
    // 递归，确保所有对象属性均响应式
    return typeof res === 'object' ? reactive(res) : res
  },
  set(target, key, val) {
    const info = { oldValue: target[key], newValue: val }
    const res = Reflect.set(target, key, val)
    // 触发更新
    trigger(target, key, val)
    return res
  }
}

function reactive(target) {
  // 查询缓存
  let observed = toProxy.get(target)
  // 如果target已被缓存，直接返回被代理的对象
  if(observed) {
    return observed
  }
  if(toRow.get(target)) {
    return target
  }
  // 数据响应式
  observed = new Proxy(target, baseHandler)
  // 设置缓存
  toProxy.set(target, observed)
  toRow.set(observed, target)
  return observed
}
/**
 * 收集依赖
 * @param {*} target 
 * @param {*} key 
 */
function track(target, key) {
  // 获取栈顶的effect
  let effect = effectStack[effectStack.length - 1]
  if(effect) {
    // 获取和target相关的依赖
    let depsMap = targetMap.get(target)
    // 如果没有target相关依赖则新建之
    if(depsMap === undefined) {
      depsMap = new Map()
      targetMap.set(target, depsMap)
    }
    // 在target相关的依赖里查找和key相关的依赖
    let dep = depsMap.get(key)
    // 如果没有key相关依赖则新建之
    if(dep === undefined) {
      dep = new Set()
      depsMap.set(key, dep)
    }
    // key相关依赖里如果没有存储此次effect，添加
    if(!dep.has(effect)) {
      dep.add(effect)
      effect.deps.push(dep)
    }
  }
}

/**
 * 触发更新
 * @param {*} target 
 * @param {*} key 
 * @param {*} info 
 */
function trigger(target, key, info) {
  // 取出和target相关的依赖
  const depsMap = targetMap.get(target)
  // 如果没有相应依赖，直接返回
  if(depsMap === undefined) {
    return
  }
  const effects = new Set()
  const computedEffects = new Set()
  if(key) {
    // 取出和key相关的依赖
    let deps = depsMap.get(key)
    // 遍历deps，将其内的effect分类，有的effect属于computed，computed也是根据effect的逻辑实现的
    deps.forEach(effect => {
      if(effect.computed) {
        computedEffects.add(effect)
      } else {
        effects.add(effect)
      }
    })
  }
  // 执行和依赖相关的effect
  effects.forEach(effect => effect())
  // 执行和依赖相关的computed
  computedEffects.forEach(effect => effect())
}

function effect(fn, options = {}) {
  let e = createReactiveEffect(fn, options)
  if(!options.lazy) {
    e()
  }
  return e
}

function createReactiveEffect(fn ,options) {
  const effect = function effect(...args) {
    return run(effect, fn, args)
  }
  effect.deps = []
  effect.computed = options.computed
  effect.lazy = options.lazy
  return effect
}

/**
 * 执行effect的回调函数
 * @param {*} effect 
 * @param {*} fn 
 * @param {*} args 
 */
function run(effect, fn, args){
  if(effectStack.indexOf(effect) === -1) {
    try {
      effectStack.push(effect)
      return fn(...args)
    } finally {
      effectStack.pop()
    }
  }
}
/**
 * computed其实也是根据effect来实现的，只是在初始化的时候不执行，访问其value属性时才执行
 * @param {*} fn 
 */
function computed(fn) {
  const runner = effect(fn, { computed: true, lazy: true })
  return {
    effect: runner,
    get value() {
      return runner()
    }
  }
}
